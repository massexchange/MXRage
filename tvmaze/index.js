var fs = require("fs"),
    path = require("path"),
    tvmaze = require("tvmaze-api"),
    stringify = require("csv-stringify"),
    moment = require("moment"),
    nconf = require("nconf"),

    DMAs = require("../dmas.json"),
    daypart = require("../daypart");

nconf.file("config.json").defaults({
    impressions: {
        upper: 150,
        lower: 30
    }
});

var parseTime = function(time) {
    return moment(time, "HH:mm");
};

var parseDay = function(day) {
    return moment(day, "YYYY-MM-DD");
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
    fs.writeFile(path.join(__dirname, "schedule.json"), JSON.stringify(schedule), err => console.log(err));
};

var fetchSchedule = function(cb) {
    console.log("requesting full schedule...");

    tvmaze.getSchedule("US", '', (err, episodes) => {
        if(err)
            throw err;

        console.log("schedule get!");

        saveSchedule(episodes);
        cb(episodes);
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
        cb(JSON.parse(contents));
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
var generateInventory = function(episodes) {
    console.log("converting to inventory...");

    var inventory = episodes.map(function(episode) {
        var parsedDay = parseDay(episode.airdate);
        var parsedTime = parseTime(episode.airtime);

        return {
            date: parsedDay.format("L"),
            time: parsedTime.format("h:mm A"),
            show: episode.show.name,
            episode: episode.number,
            title: episode.name,
            type: episode.show.type,
            network: episode.show.network.name,
            daypart: daypart(parsedTime.hour()),
            impressions: generateImpressions()
        }
    }).map(excludeIgnoredCols);

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

var createCsvFile = function(inventory, cb) {
    console.log("converting to record format...");
    var colNames = Object.keys(inventory[0]);
    var records = [colNames].concat(inventory.map(function(inv) {
        return colNames.map(function(key) { return inv[key]; });
    }));
    console.log("converted!");

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
    createCsvFile(inventory);
});
