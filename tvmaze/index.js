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

    var attributes = nconf.get("attributes");
    if(attributes)
        inventory = Object.keys(attributes).reduce((invs, attr) => {
            var values = attributes[attr];
            console.log(`crossing with 2 ${attr} values...`);

            return values.map(attrVal =>
                invs.map(inv => {
                    var newInv = Object.assign({}, inv);
                    newInv[attr] = attrVal;
                    return newInv;
                })
            ).reduce(concat);
        }, inventory);

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
    var inventory = generateInventory(schedule);
    createCsvFile(inventory);
});
