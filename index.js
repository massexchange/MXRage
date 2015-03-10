var fs = require("fs"),
	path = require("path"),
	TVRage = require("tvragejson"),
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

var printSchedule = function(schedule) {
	schedule.DAY.forEach(printDay);
};

var saveSchedule = function(schedule) {
	fs.writeFile(path.join(__dirname, "schedule.json"), JSON.stringify(schedule), function(err) {
        if(err) console.log(err);
    });
};

var fetchSchedule = function(cb) {
	TVRage.fullSchedule("US", function(err, res) {
		console.log("schedule get!");
		saveSchedule(res.schedule);
		cb(res.schedule);
	});
};

var loadSchedule = function(cb) {
	fs.readFile(path.join(__dirname, "schedule.json"), function(err, contents) {
		if(err && err.code == "ENOENT") {
			fetchSchedule(cb);
			return;
		}

		var schedule = JSON.parse(contents);
		cb(schedule);
	});
};

console.log("requesting full schedule...");
loadSchedule(printSchedule);