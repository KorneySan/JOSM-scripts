// Копирование имён остановки
// v. 1.2 2023.03.11
// © KorneySan (https://github.com/KorneySan) при участии h1tsmart (https://github.com/h1tsmart)
// var api = require("josm/api").Api; //не требуется в Java 17
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
				var new_ds = api.downloadObject(cur_rel, {full: true});
				ds.mergeFrom(new_ds);
		    }
			util.println("Stop Area named '{0}' was found.", cur_rel.get("name"));
			//josm.alert("Найдена зона "+cur_rel.get("name")+" .");
		    //копируем имя на отношение
			activeLayer.apply(
				cmd.change(cur_rel, {tags: {name: cur_node.get("name"), 
										    "name:ru": cur_node.get("name:ru"), 
											"name:be": cur_node.get("name:be")
										   }})
			);
			if (cur_rel.get("ref") == null && cur_node.get("ref") != null) {
				activeLayer.apply(
					cmd.change(cur_rel, {tags: {ref: cur_node.get("ref")}})
				);
			}
			else {
				if (cur_node.get("ref") == null && cur_rel.get("ref") != null) {
					activeLayer.apply(
						cmd.change(cur_node, {tags: {ref: cur_rel.get("ref")}})
					);
				}
			}
			if (cur_rel.get("operator") == null && cur_node.get("operator") != null) {
				activeLayer.apply(
					cmd.change(cur_rel, {tags: {operator: cur_node.get("operator")}})
				);
			}
			else {
				if (cur_node.get("operator") == null && cur_rel.get("operator") != null) {
					activeLayer.apply(
						cmd.change(cur_node, {tags: {operator: cur_rel.get("operator")}})
					);
				}
			}
			
            var members = cur_rel.members;
            for (var i=0; i<members.length; i++) {
				util.println("Member {0} has type {1}", i, members[i].getType());

			    if (members[i].getType() === Node 
				    && (cur_rel.getRoleAt(i) == "platform" || cur_rel.getRoleAt(i) == "stop_position") 
					&& members[i] != cur_node) {
        		    //копируем имя на элемент отношения
                    var member = members[i].getMember();

					activeLayer.apply(
						cmd.change(member, {tags: {name: cur_node.get("name"), 
												   "name:ru": cur_node.get("name:ru"), 
												   "name:be": cur_node.get("name:be")
												  }})
					);
					if (member.get("ref") == null && cur_rel.get("ref") != null) {
						activeLayer.apply(
							cmd.change(member, {tags: {ref: cur_rel.get("ref")}})
						);
					}
					if (member.get("operator") == null && cur_rel.get("operator") != null) {
						activeLayer.apply(
							cmd.change(member, {tags: {operator: cur_rel.get("operator")}})
						);
					}
					//josm.alert("Установлено.");
				}
			}
		}
	}
	josm.alert("Выполнено");
});
