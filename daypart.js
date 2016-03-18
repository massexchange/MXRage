var dayParts = {
    2: "Overnight",
    4: "Early Morning",
    6: "Breakfast",
    10: "Daytime",
    17: "Primetime",
    23: "Late Night"
};

var determineDayPart = function(time) {
    if(isNaN(time))
        throw new Error("must be a number");

    var tryGetPart = function(hour) {
        if(hour === 0) hour = 24;

        return dayParts[hour]
            ? dayParts[hour]
            : tryGetPart(--hour);
    };
    return tryGetPart(Math.floor(time));
};

module.exports = determineDayPart;
