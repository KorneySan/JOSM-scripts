// Остановка из точки
// v. 1.1 2023.03.25
// © h1tsmart (https://github.com/h1tsmart)
// © KorneySan (https://github.com/KorneySan)
// var api = require("josm/api").Api;  //не требуется в Java 17
var util = require("josm/util");
var cmd = require("josm/command");
var layers = require("josm/layers");
var nb = require("josm/builder").NodeBuilder;
var activeLayer = layers.activeLayer;
util.assert(activeLayer != null, "Нет активного слоя!");
var ds = activeLayer.data;
var Geometry = org.openstreetmap.josm.tools.Geometry;
var ProjectionRegistry = org.openstreetmap.josm.data.projection.ProjectionRegistry;
var getParentRelations = org.openstreetmap.josm.data.osm.OsmPrimitive.getParentRelations;
var NodeBuilder = require("josm/builder").NodeBuilder;
var WayBuilder = require("josm/builder").WayBuilder;
var RelationBuilder = require("josm/builder").RelationBuilder;
var member = RelationBuilder.member;
var nbuilder = new NodeBuilder();
var rbuilder = new RelationBuilder();
var wbuilder = new WayBuilder();

function insert_arr_in_arr(arr1,pos,arr2) {
  var begin = arr1.slice(0,pos);
  var end = arr1.slice(pos);
  return begin.concat(arr2).concat(end);
}
function arr_min_idx(arr) {
  var min_val = arr[0];
  var min_idx = 0;
  for (var i=0; i<arr.length; i++) {
    if(min_val > arr[i]) {
      min_val = arr[i];
      min_idx = i;
    }
  }
  return min_idx;
}
function print_arr(arr, name) {
  for (var i=0; i<arr.length; i++) {
    util.println("{0}[{1}] = {2}", name, i, arr[i]);
  }
  if(arr.length==0)
    util.println("arr {0} empty", name);
}

//возвращает координаты ближайшей точки линии к переданной точке и индекс ближайшего сегмента линии
function get_nearest(node, way) {
  var dists = [];
  var coords_en = []; //координаты в EastNorth
  var min_dist_val, min_dist_idx;

  var cur_node_en = node.getEastNorth();
  for (var i=1; i<way.length; i++) {
    var nearestPoint = Geometry.closestPointToSegment(way[i-1].getEastNorth(),way[i].getEastNorth(),cur_node_en);
    var cur_dist = cur_node_en.distance(nearestPoint); // is the distance in _projected units_
    dists.push(cur_dist);
    coords_en.push(nearestPoint);
  }

  var min_idx = arr_min_idx(dists);

  // print_arr(dists,"dists");
  // util.println("min_idx {0}", min_idx);

  //переводим координаты в LatLon
  var ll = ProjectionRegistry.getProjection().eastNorth2latlon( coords_en[min_idx]);
  return {latlon: ll, segment_idx: min_idx};
}

//находим выделенную точку
var nodes_len = ds.selection.nodes.length;
util.println("nodes_len {0}", nodes_len);
util.assert(nodes_len==1, "Должна быть выделена <b>одна</b> точка, выделено <b>{0}</b> !", nodes_len);
var cur_node = ds.selection.nodes[0];

//определяем, что мы из неё делаем
var node_mode = -1;
if (cur_node.get("public_transport") == "platform") {
	node_mode = 2;
	util.println("Stop Platform is selected.");
	// josm.alert("Работаем с платформой");
}
else {
	if (cur_node.get("public_transport") == "stop_position") {
		node_mode = 1;
		util.println("Stop Position is selected.");
		// josm.alert("Работаем с местом остановки");
	}
  else if (cur_node.get("highway") == "bus_stop") {
		node_mode = 0;
		util.println("Stop uncertain is selected.");
		// josm.alert("Работаем с чем-то из остановок");
	}
}
util.assert(node_mode >= 0, "Выбранная точка не подходит для работы!");

//находим выделенную линию
var ways_len = ds.selection.ways.length;
util.assert(ways_len==1, "Должна быть выделена <b>одна</b> линия, выделено <b>{0}</b> !", ways_len);
var cur_way = ds.selection.ways[0];
//определяем, подходит ли она нам
var way_mode = -1;
if ((0 == node_mode || 2 == node_mode) && cur_way.get("highway") != null && cur_way.get("highway") != "footway") {
	way_mode = 1;
	util.println("Way from Platform to Stop Position.");
	// josm.alert("C платформы на остановку");
}
else if ((0 == node_mode || 1 == node_mode) && (cur_way.get("public_transport") == "platform" || cur_way.get("highway") == "footway")) {
	way_mode = 0;
	util.println("Way from Stop Position to Platform.");
}
util.assert(way_mode >= 0, "Выбранная линия не подходит для работы!");

var nearest = get_nearest(cur_node, cur_way);

var new_node = nbuilder
    .withPosition(nearest.latlon.lat,nearest.latlon.lon)
    .withTags({"public_transport": 1 == way_mode ? "stop_position" : "platform",
			   "name": cur_node.get("name"),
			   "name:ru": cur_node.get("name:ru"),
			   "name:be": cur_node.get("name:be"),
			   "ref": cur_node.get("ref"),
			   "operator": cur_node.get("operator")
			 })
    .create();

var way_nodes_new = insert_arr_in_arr(cur_way.nodes,nearest.segment_idx+1,[new_node]);
var new_way = wbuilder
    .withNodes(cur_node,new_node)
    .withTags({"highway":"footway",
               "footway":"link",
               "public_transport":"entrance_pass"
             })
    .create();
	
//создаём отношение зоны остановки
var stop_area_rel = rbuilder
    .withTags({"type": "public_transport",
               "public_transport": "stop_area",
               "name": cur_node.get("name"),
		       "name:ru": cur_node.get("name:ru"),
		       "name:be": cur_node.get("name:be"),
			   "ref": cur_node.get("ref"),
			   "operator": cur_node.get("operator")
			 })
    .withMembers(member("stop", 1 == way_mode ? new_node : cur_node),
	             member("platform", 1 == way_mode ? cur_node : new_node),
			     member("entrance_pass", new_way))
    .create();

//меняем исходную точку при необходимости
if (1 == way_mode) {
	//обозначаем платформу
	if (cur_node.get("public_transport") != "platform") {
		activeLayer.apply(
			cmd.change(cur_node, {tags: {public_transport: "platform"}})
		);
	}
} else {
	//обозначаем место остановки
	if (cur_node.get("public_transport") != "stop_position" || cur_node.get("highway") != null) {
		activeLayer.apply(
			cmd.change(cur_node, {tags: {public_transport: "stop_position", highway: ""}})
		);
	}
}

activeLayer.apply(
  cmd.add(new_node),
  cmd.change(cur_way,{nodes: way_nodes_new}),
  cmd.add(new_way),
  cmd.add(stop_area_rel)
);

//добавляем новую точку в родительские отношения маршрутов выделенной точки
var pr = getParentRelations([cur_node]);
var iter = pr.iterator();
while(iter.hasNext()) {
	var cur_rel = iter.next();

	if(cur_rel.get("type") == "route") {
		util.println("Route named {0} was found.", cur_rel.get("name"));

    var cur_node_pos; //позиция выделенной точки
    for (cur_node_pos=0; cur_node_pos<cur_rel.length; cur_node_pos++) {
      if (cur_rel.getIdAt(cur_node_pos) == cur_node.id)
        break;
    }

    var members_with_new_node;
    if( 1 == way_mode )
      members_with_new_node = insert_arr_in_arr(cur_rel.members, cur_node_pos,[member("stop",new_node)]);
    else
      members_with_new_node = insert_arr_in_arr(cur_rel.members, cur_node_pos+1,[member("platform",new_node)]);

    activeLayer.apply(
      cmd.change(cur_rel, {members: members_with_new_node})
    );
  }
}
