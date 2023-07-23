// Копирование имён остановки
// v. 2.0 2023.03.11
// © KorneySan (https://github.com/KorneySan) при участии h1tsmart (https://github.com/h1tsmart)
// Адаптация под JavaScript API V3
import josm from 'josm'
import { Api } from 'josm/api'
import { assert, println } from "josm/util"
import { buildChangeCommand } from "josm/command"
import layers from "josm/layers"
import { NodeBuilder } from "josm/builder"
let nb = new NodeBuilder()
var activeLayer = layers.activeLayer;
assert(activeLayer != null, "Нет активного слоя!");
var getParentRelations = org.openstreetmap.josm.data.osm.OsmPrimitive.getParentRelations;
var ds = activeLayer.data;
var Node = org.openstreetmap.josm.data.osm.OsmPrimitiveType.NODE;
var Relation = org.openstreetmap.josm.data.osm.OsmPrimitiveType.RELATION;
//находим выделенную точку
var rel_len = ds.selection.nodes.length;
println("rel_len {0}", rel_len);
assert(rel_len==1, "Выделенной точки нет или она не одна.");
var cur_node = ds.selection.nodes[0];
if (cur_node.get("public_transport") == "stop_position") {
	println("Stop Position is selected.");
	//josm.alert("Работаем с остановкой");
}
if (cur_node.get("public_transport") == "platform") {
	println("Stop Platform is selected.");
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
				var new_ds = Api.downloadObject(cur_rel, {full: true});
				ds.mergeFrom(new_ds);
		    }
			println("Stop Area named '{0}' was found.", cur_rel.get("name"));
			//josm.alert("Найдена зона "+cur_rel.get("name")+" .");
		    //копируем имя на отношение
			buildChangeCommand(cur_rel, {tags: {name: cur_node.get("name"), 
								"name:ru": cur_node.get("name:ru"), 
								"name:be": cur_node.get("name:be")
								}}).applyTo(activeLayer)
			if (cur_rel.get("ref") == null && cur_node.get("ref") != null) {
				buildChangeCommand(cur_rel, {tags: {ref: cur_node.get("ref")}}).applyTo(activeLayer)
			}
			else {
				if (cur_node.get("ref") == null && cur_rel.get("ref") != null) {
					buildChangeCommand(cur_node, {tags: {ref: cur_rel.get("ref")}}).applyTo(activeLayer)
				}
			}
			if (cur_rel.get("operator") == null && cur_node.get("operator") != null) {
				buildChangeCommand(cur_rel, {tags: {operator: cur_node.get("operator")}}).applyTo(activeLayer)
			}
			else {
				if (cur_node.get("operator") == null && cur_rel.get("operator") != null) {
					buildChangeCommand(cur_node, {tags: {operator: cur_rel.get("operator")}}).applyTo(activeLayer)
				}
			}
			
            var members = cur_rel.members;
            for (var i=0; i<members.length; i++) {
				println("Member {0} has type {1}", i, members[i].getType());

			    if (members[i].getType() === Node 
				    && (cur_rel.getRoleAt(i) == "platform" || cur_rel.getRoleAt(i) == "stop_position") 
					&& members[i] != cur_node) {
        		    //копируем имя на элемент отношения
                    var member = members[i].getMember();

					buildChangeCommand(member, {tags: {name: cur_node.get("name"), 
										"name:ru": cur_node.get("name:ru"), 
										"name:be": cur_node.get("name:be")
										}}).applyTo(activeLayer)
					if (member.get("ref") == null && cur_rel.get("ref") != null) {
						buildChangeCommand(member, {tags: {ref: cur_rel.get("ref")}}).applyTo(activeLayer)
					}
					if (member.get("operator") == null && cur_rel.get("operator") != null) {
						buildChangeCommand(member, {tags: {operator: cur_rel.get("operator")}}).applyTo(activeLayer)
					}
					//josm.alert("Установлено.");
				}
			}
		}
	}
	josm.alert("Выполнено");
});
