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

var dateFormat = "YYYY-MM-DD";

var parseTime = time => moment(time, "HH:mm");
var parseDay = day => moment(day, dateFormat);

var formatDate = date => date.format(dateFormat);

var schedulePath = date => path.join(__dirname, `schedule_${date}.json`);

var saveSchedule = function(date, schedule) {
    fs.writeFile(schedulePath(date), JSON.stringify(schedule), err => { if(err) { console.log(err); } });
};

var fetchSchedule = function(date, cb) {
    console.log(`requesting schedule for ${date}...`);

    tvmaze.getSchedule("US", date, (err, episodes) => {
        if(err)
            throw err;

        console.log(`${date} schedule get!`);

        saveSchedule(date, episodes);
        cb(episodes);
    });
};

var loadSchedule = function(dates, cb) {
    console.log("checking for cached schedule...");

    var schedules = {};

    var addScheduleCb = date => schedule => {
        schedules[date] = schedule;

        var schedKeys = Object.keys(schedules);
        //if we have all requested schedules
        if(schedKeys.length == dates.length)
            //stick em all into one array and pass it on
            cb(schedKeys.map(key => schedules[key]).reduce(concat));
    }

    var fileCb = date => (err, data) => {
        var addSchedule = addScheduleCb(date);

        //if we don't have this schedule cached
        if(err && err.code == "ENOENT") {
            console.log(`no cache for ${date}!`);
            fetchSchedule(date, addSchedule);
            return;
        }

        console.log(`loaded cached schedule for ${date}`);
        addSchedule(JSON.parse(data));
    };

    //attempt to load cached schedules
    dates.map(date => [date, path.join(__dirname, `schedule_${date}.json`)])
         .forEach(([date, path]) => fs.readFile(path, fileCb(date)));
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
        var parsedTime = parseTime(episode.airtime || "12:00");

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

var range = function (a, b) {
    var out = [];
    for(var i = a; i <= b; i++) out.push(i);
    return out;
};

var today = moment();
var dateCount = nconf.get("days:count") || 1;
var dates = range(0, dateCount-1)
    .map(days => today.clone().add(days, 'd'))
    .map(formatDate);

loadSchedule(dates, schedule => {
    var inventory = generateInventory(schedule);
    createCsvFile(inventory);
});
