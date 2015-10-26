var fs = require("fs"),
    path = require("path"),
    TVRage = require("tvragejson"),
    stringify = require("csv-stringify"),
    moment = require("moment"),
    nconf = require("nconf"),

    DMAs = require("./dmas.json");

nconf.file("config.json").defaults({
    impressions: {
        upper: 150,
        lower: 30
    }
});

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

var parseTime = function(time) {
    return moment(time, "hh:mm a");
};

var parseDay = function(day) {
    return moment(day, "YYYY-M-D");
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
    console.log("requesting full schedule...");
    TVRage.fullSchedule("US", function(err, res) {
        console.log("schedule get!");
        saveSchedule(res.schedule);
        cb(res.schedule);
    });
};

var loadSchedule = function(cb) {
    console.log("checking for cached schedule...");
    fs.readFile(path.join(__dirname, "schedule.json"), function(err, contents) {
        if(err && err.code == "ENOENT") {
            console.log("no cache!");
            fetchSchedule(cb);
            return;
        }
        console.log("loaded!");
        var schedule = JSON.parse(contents);
        cb(schedule);
    });
};

var concat = function(a, b) {
    return a.concat(b);
};
var generateImpressions = function() {
    var upperBound = nconf.get("impressions:upper");
    var lowerBound = nconf.get("impressions:lower");
    return Math.floor(lowerBound + ((upperBound - lowerBound) * Math.random()));
};
var excludeIgnoredCols = function(inv) {
    nconf.get("columns:ignored").forEach(function(col) {
        delete inv[col];
    });
    return inv;
};
var generateInventory = function(schedule) {
    console.log("converting to inventory...");
    var inventory = schedule.DAY.map(function(day) {
        var parsedDay = parseDay(day.$.attr)._d;

        var times = Array.isArray(day.time) ? day.time : [day.time];
        return times.map(function(time) {
            var parsedTime = parseTime(time.$.attr);

            var shows = Array.isArray(time.show) ? time.show : [time.show];
            return shows.map(function(show) {
                return {
                    MONTH: parsedDay,
                    Time: parsedTime.format("h:mm A"),
                    Network: show.network,
                    Show: show.$.name,
                    Episode: show.ep[0],
                    Title: show.title[0],
                    Daypart: determineDayPart(parsedTime.hour()),
                    Impressions: generateImpressions()
                };
            }).map(excludeIgnoredCols);
        }).reduce(concat);
    }).reduce(concat);

    var limit = nconf.get("limit");
    if(limit)
        inventory = inventory.slice(0, limit);

    console.log("conversion complete!");

    if(nconf.get("dmas")) {
        console.log("crossing with dmas...");
        inventory = DMAs.map(function(dma) {
            return inventory.map(function(inv) {
                inv.DMA = dma[1];
                return inv;
            });
        }).reduce(concat);
        console.log("dmas complete!");
    }

    var slots = nconf.get("slots");
    if(slots) {
        console.log("crossing with slots...");
        inventory = slots.map(function(slot) {
            return inventory.map(function(inv) {
                inv.Slot = slot + " secs";
                return inv;
            });
        }).reduce(concat);
        console.log("slots complete!");
    }

    console.log("inventory generated!");

    return inventory;
};

var createExcelFile = function(inventory, cb) {
    console.log("converting to record format...");
    var colNames = Object.keys(inventory[0]);
    var records = [colNames].concat(inventory.map(function(inv) {
        return colNames.map(function(key) { return inv[key]; });
    }));
    console.log("converted!");

    // console.log("building excel file...");
    // var file = xlsx.build([{name: "Market View", data: records}]);
    // console.log("built!");

    console.log("building csv file...");
    var file = stringify(records, function(err, out) {
        console.log("built!");

        console.log("writing file...");
        fs.writeFile("schedule.csv", out, function(err) {
            if(err) {
                console.log("Error: ", err);
                process.exit(1);
            }

            console.log("file written!");
        });
    });
};

loadSchedule(function(schedule) {
    //printSchedule(schedule);
    var inventory = generateInventory(schedule);
    createExcelFile(inventory);
});
