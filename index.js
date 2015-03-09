var TVRage = require("tvragejson"),
	xlsx = require('node-xlsx');

var indent = function(times) { return Array(times ? times : 1).join('\t'); };

var printShow = function(show) {
	console.log(indent(2), "Show: ", show.$.name);
	console.log(indent(2), "Show ID: ", show.sid);
	console.log(indent(2), "Episode: ", show.ep);
	console.log(indent(2), "Title: ", show.title);
	console.log(indent(2), "Network: ", show.network);
	console.log(indent(2), "Link: ", show.link);
};

var printTime = function(time) {
	console.log(indent(), "Time: ", time.$.attr);
	time.show.forEach(printShow);
};

var printDay = function(day) {
	console.log("Day: ", day.$.attr);
	day.time.forEach(printTime);
};

console.log("requesting full schedule...");
TVRage.fullSchedule("US", function(err, res) {
	console.log("schedule get!");
	var schedule = res.schedule;
	schedule.DAY.forEach(printDay);
});