var api = require("josm/api").Api;
var util = require("josm/util");
var cmd = require("josm/command");
var layers = require("josm/layers");
var nb = require("josm/builder").NodeBuilder;
var activeLayer = layers.activeLayer;
util.assert(activeLayer != null, "Нет активного слоя!");
var getParentRelations = org.openstreetmap.josm.data.osm.OsmPrimitive.getParentRelations;
var ds = activeLayer.data;
var Node = org.openstreetmap.josm.data.osm.OsmPrimitiveType.NODE;
var Relation = org.openstreetmap.josm.data.osm.OsmPrimitiveType.RELATION;
//находим выделенную точку
var rel_len = ds.selection.nodes.length;
util.println("rel_len {0}", rel_len);
util.assert(rel_len==1, "Выделенной точки нет или она не одна.");
var cur_node = ds.selection.nodes[0];
if (cur_node.get("public_transport") == "stop_position") {
	util.println("Stop Position is selected.");
	//josm.alert("Работаем с остановкой");
}
if (cur_node.get("public_transport") == "platform") {
	util.println("Stop Platform is selected.");
	//josm.alert("Работаем с платформой");
}
ds.batch(function() {
	//находим родительское отношение
	var pr = getParentRelations([cur_node]);
	var iter = pr.iterator();
	while(iter.hasNext()) {
		var cur_rel = iter.next();
		if(cur_rel.get("public_transport") == "stop_area") {
		    if (cur_rel.hasIncompleteMembers()) {
			    //докачиваем неполные элементы
				api.downloadObject(cur_rel, {full: true});
		    }
			util.println("Stop Area named '{0}' was found.", cur_rel.get("name"));
			//josm.alert("Найдена зона "+cur_rel.get("name")+" .");
		    //копируем имя на отношение
			cur_rel.setModified(true);
			activeLayer.apply(
				cmd.change(cur_rel, {tags: {name: cur_node.get("name")}}),
				cmd.change(cur_rel, {tags: {"name:ru": cur_node.get("name:ru")}}),
				cmd.change(cur_rel, {tags: {"name:be": cur_node.get("name:be")}})
			);
            var members = cur_rel.members;
            for (var i=0; i<members.length; i++) {
				util.println("Member {0} has type {1}", i, members[i].getType());

			    if (members[i].getType() === Node 
				    && (cur_rel.getRoleAt(i) == "platform" || cur_rel.getRoleAt(i) == "stop_position") 
					&& members[i] != cur_node) {
        		    //копируем имя на элемент отношения
                    var member = members[i].getMember();

		            member.setModified(true);
					activeLayer.apply(
						cmd.change(member, {tags: {name: cur_node.get("name")}}),
						cmd.change(member, {tags: {"name:ru": cur_node.get("name:ru")}}),
						cmd.change(member, {tags: {"name:be": cur_node.get("name:be")}})
					);
					//josm.alert("Установлено.");
				}
			}
		}
	}
	josm.alert("Выполнено");
});
