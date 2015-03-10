var fs = require("fs"),
	path = require("path"),
	TVRage = require("tvragejson"),
	xlsx = require('node-xlsx'),
	moment = require("moment");

var dayParts = {
	2: "Overnight",
	4: "Early Morning",
	6: "Breakfast",
	10: "Daytime",
	17: "Primetime",
	23: "Late Night"
};

var determineDayPart = function(time) {
	var tryGetPart = function(hour) {
    if(hour === 0) hour = 24;

		return dayParts[hour]
			? dayParts[hour]
			: tryGetPart(--hour);
	};
	return tryGetPart(Math.floor(time));
};

var indent = function(times) { return Array(times ? times : 1).join('\t'); };

var printShow = function(show) {
	console.log(indent(2), "Show: ", show.$.name);
	console.log(indent(2), "Show ID: ", show.sid);
	console.log(indent(2), "Episode: ", show.ep);
	console.log(indent(2), "Title: ", show.title);
	console.log(indent(2), "Network: ", show.network);
	console.log(indent(2), "Link: ", show.link);
};

var parseTime = function(time) {
	return moment(time, "hh:mm a");
};

var parseDay = function(day) {
	return moment(day, "YYYY-M-D");
};

var printTime = function(time) {
	var parsedTime = parseTime(time.$.attr);
	console.log(indent(), "Time: ", parsedTime.format("h:mm A"));
	console.log(indent(), "DayPart: ", determineDayPart(parsedTime.hour()));
	console.log("Shows: ");
	time.show.forEach(printShow);
};

var printDay = function(day) {
	console.log("Day: ", parseDay(day.$.attr).format("MMM Do, YYYY"));
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

var generateInventory = function(schedule) {
	var generateImpressions = function() {
		var upperBound = 150;
		var lowerBound = 30;
		return Math.floor(lowerBound + ((upperBound - lowerBound) * Math.random()));
	};

	var inventory = schedule.DAY.map(function(day) {
		var parsedDay = parseDay(day.$.attr).format("MMM Do, YYYY");
		return day.time.map(function(time) {
			var parsedTime = parseTime(time.$.attr);

			return time.show.map(function(show) {
				return {
					Day: parsedDay,
					Time: parsedTime.format("h:mm A"),
					Network: show.network[0],
					Show: show.$.name,
					Episode: show.ep[0],
					Title: show.title[0],
					Daypart: determineDayPart(parsedTime.hour()),
					Impressions: generateImpressions()
				};
			});
		}).reduce(function(a, b) {
			return a.concat(b);
		});
	}).reduce(function(a, b) {
		return a.concat(b);
	});

	return inventory;
};

var createExcelFile = function(inventory, cb) {
	fs.writeFile("schedule.xlsx", xlsx.build([{name: "Market View", data: inventory}]), cb);
};

console.log("requesting full schedule...");
loadSchedule(function(schedule) {
	//printSchedule(schedule);
	console.log("generating inventory...");
	var inventory = generateInventory(schedule);
	console.log(inventory);
	console.log("writing excel file...");
	createExcelFile(inventory, function(err) {
		if(err) {
			console.log(err);
			return;
		}

		console.log("file written!");
	});
});
