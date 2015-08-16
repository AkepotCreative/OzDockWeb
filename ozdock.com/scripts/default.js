var map; // Google Map
var ws; // WebSocket
var lat; // Client Latitude
var long; // Client Longitude
var geoacq; // Client location acquired true/false
var temptimer; // Timer to refresh temperature
var lockmap; // Lock the map to specific location
var markers = new Array(); // Array to store map markers
var tweets = new Array(); // Array to store listed tweets
var tweettemplate = '<div id="{ID}" class="tweet">'
                + '<img class="tweetprofileimg" src="{PROFILEIMAGE}" />'
                + '<div class="tweetname"><a href="https://twitter.com/intent/user?screen_name={USERID}" target="_blank"><b>{NAME}</b><br /> <span class="tweetuser">@{USERID}</span></a></div>'
                + '<div class="date">{TIME}</div>'
                + '<div class="text">{TEXT}</div>'
                + '{MEDIA}'
                + '<div class="tweetopen"><a href="https://twitter.com/{USERID}/status/{ID}" target="_blank">Open</a></div>'
                + '<hr />'
                + '</div>';
var LockMapPos = false;
var LockTweetPos = false;

// Limited Dependencies
// Some sites may prefer to embed the unobtrusive Web Intents pop-up Javascript inline or without a dependency to platform.twitter.com.
// The snippet below will offer the equivalent functionality without the external dependency.
// https://dev.twitter.com/web/intents

$(document).ready(function () {
    LoadMap();
    $('#Tweets').niceScroll();

    if ('WebSocket' in window) {
        opensocket();
    }
    else {
        browsererror();
        return;
    }
});

function opensocket() {
    ws = new WebSocket("ws://websockets.ozdock.com:80");
    ws.onopen = function () {
        // connection opened
        $('#Overlay').css('display', 'none');

        GetGeoLocation();
    }

    ws.onmessage = function (evt) {
        var msg = $.parseJSON(evt.data);
        cmd = msg.command;
        switch (cmd) {
            case "tweet":
                // desktop version
                PostTweet(msg);

                // mobile version
                // PostTweetMobile(msg);
                break;
            default:
                // unrecognized command
                console.debug(msg);
                return;
        }
    }

    ws.onclose = function (evt) {
        // connection closed
        console.debug(evt);
        connectionlost();
    }

    ws.onerror = function (evt) {
        // connection error
        console.debug(evt);
        connectionlost();
    }
}

function browsererror() {
    $('#ModalMessage').html('Your browser version is unsupported. Please update to the newest version.');
    $('#Overlay').css('display', 'block');
}

function LoadMap() {
    var myOptions = {
        zoom: 6,
        center: new google.maps.LatLng(39.035992, -95.693611),
        disableDefaultUI: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    var myStyles = [
        {
            featureType: 'all',
            stylers: [
                { saturation: -70 }
            ]
        },
        {
            featureType: 'poi',
            stylers: [
                { visibility: 'off' }
            ]
        },
        {
            featureType: 'landscape',
            stylers: [
                { visibility: 'off' }
            ]
        }
    ];
    map = new google.maps.Map(document.getElementById('GoogleMap'), myOptions);
    map.setOptions({ styles: myStyles });
    //var imageBounds = new google.maps.LatLngBounds(new google.maps.LatLng(22.652538062803, -128.620375523875420), new google.maps.LatLng(51.406626367301044, -67.517937876818));
    //var radarmap = new google.maps.GroundOverlay('http://radblast-mi.wunderground.com/cgi-bin/radar/WUNIDS_composite?maxlat=50.406626367301044&maxlon=-66.517937876818&minlat=21.652538062803&minlon=-127.620375523875420&type=N0R&frame=0&width=9775&height=4600&png=0&smooth=1&min=2&noclutter=0&rainsnow=1&nodebug=0&theext=.gif&brand=wundermap&reproj.automerc=1&merge=elev&rand=21854266', imageBounds);
    //radarmap.setMap(map);
}

function connectionlost() {
    // shutdown timers
    clearInterval(temptimer);

    // display modal
    $('#ModalMessage').html('Connection to the server lost.<br /><br />Please submit a ticket to<br />support@ozdock.com');
    $('#Overlay').css('display', 'block');
}

function SetDefaultGeo() {
    geoacq = false;
    lat = '39.035992';
    long = '-95.693611';
}

function GetGeoLocation() {
    geoacq = false;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(geosuccess, geofail, { timeout: 5000, enableHighAccuracy: false });
    }
    else {
        // geolocation unavailable, default to Topeka
        SetDefaultGeo();
        GetTemperature();
    }
}

function GetTemperature() {
    $.ajax({
        url: "http://api.wunderground.com/api/ad78a0446ba1dccf/geolookup/conditions/q/" + lat + "," + long + ".json",
        dataType: "jsonp",
        success: function (parsed_json) {
            var location = parsed_json['location']['city'];
            var temp_f = parsed_json['current_observation']['temp_f'];
            temp_f = Math.round(temp_f);
            $('#Temperature').html(temp_f + '&deg;');
            if (!geoacq) {
                $('#Temperature').attr('title', 'Your location was not found. Using default location.');
            }
            else {
                $('#Temperature').attr('title', location);
            }
        }
    });
}

function geosuccess(position) {
    lat = position.coords.latitude;
    long = position.coords.longitude;
    GetTemperature();
    var UserPosition = new google.maps.LatLng(lat, long);
    map.panTo(UserPosition);
    geoacq = true;
    temptimer = setInterval(function () { GetTemperature(); }, 300000); // update temp every 5 minutes (300,000ms)
}

function geofail() {
    geoacq = false;
    SetDefaultGeo();
}

function PostTweet(tweet) {
    // if more than 15 markers, remove one before adding one
    if (markers.length > 15) {
        var removedmarker = markers.shift();
        removedmarker.setMap(null);
    }

    // if more than 15 tweets, remove one before adding one
    if (tweets.length > 15) {
        var removedtweet = tweets.shift();
        $("#" + removedtweet).remove();
    }

    var tweetid = tweet.tweetid;
    var tweethtml = tweettemplate;
    tweethtml = tweethtml.replace(/\{ID\}/g, tweetid);
    tweethtml = tweethtml.replace(/\{PROFILEIMAGE\}/g, tweet.profile_image_url_https);
    tweethtml = tweethtml.replace(/\{USERID\}/g, tweet.screen_name);
    tweethtml = tweethtml.replace(/\{NAME\}/g, tweet.name);
    tweethtml = tweethtml.replace(/\{TIME\}/g, tweet.created_at);
    tweethtml = tweethtml.replace(/\{TEXT\}/g, tweet.text);

    // add media if exists
    if (tweet.media_url_https != null) {
        tweethtml = tweethtml.replace(/\{MEDIA\}/g, '<img class="tweetimg" src="' + tweet.media_url_https + '" />');
    }
    else {
        tweethtml = tweethtml.replace(/\{MEDIA\}/g, '');
    }

    // check if Tweets content is scrolled
    var currentscroll = $("#Tweets").scrollTop();

    // add to page
    $('#Tweets').prepend(tweethtml);

    // add tweetid to array
    tweets.push(tweetid);

    // if the scroll wasn't top, move to account for added content
    if (currentscroll > 0) {
        $("#Tweets").scrollTop(currentscroll + $("#" + tweetid).height() + 5);
    }


    console.debug(currentscroll + ", " + $("#" + tweetid).height());

    // Clean up the coords
    var coords = tweet.coordinates;
    coords = coords.replace(/(\r\n|\n|\r)/gm, '');
    coords = coords.replace('[', '');
    coords = coords.replace(']', '');
    coords = coords.replace(' ', '');
    coords = coords.split(',');
    var lng = coords[0];
    var lat = coords[1];

    // add marker to map
    var marker = new google.maps.Marker({
        position: new google.maps.LatLng(lat, lng),
        map: map,
        icon: getCircle(20),
        title: tweet.name // do something with title?
    });

    // add marker to array
    markers.push(marker);

    // marker clicked
    google.maps.event.addListener(marker, 'click', function () {
        var curmarker = this; // save marker to variable because setTimeout overrides this
        $("#" + tweetid).css("background-color", "hsla(197, 100%, 47%, 0.3)"); // increase tweet background visibilty
        var currentpos = $("#Tweets").scrollTop();
        var tweetpos = $("#" + tweetid).position().top;
        var half = $("#Tweets").height() / 2;
        var max = $("#Tweets").prop("scrollHeight");
        var scrollto = tweetpos + currentpos - half; // get position to scroll to put tweet about middle of tweet list
        if (scrollto < 0) {
            scrollto = 0; // if it's higher than top, scroll to top
        }
        else if (scrollto > max) {
            scrollto = max; // lower than bottom, scroll to bottom
        }
        $("#Tweets").animate({ // animate scroll to tweet
            scrollTop: scrollto
        }, 1000);

        //setTimeout(function () { // change tweet back to original background after 4 seconds
        //    curmarker.setAnimation(null);
        //    $("#" + tweetid).css("background-color", "");
        //}, 4000);
    });

    $("#" + tweetid).click(function (sender) {
        // tweet clicked, show on map
        map.panTo(marker.getPosition());
        marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(function () {
            marker.setAnimation(null);
        }, 2000);
    });
}

// getCircle creates a circle for the map markers
function getCircle(magnitude) {
    var circle = {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: 'blue',
        fillOpacity: .6,
        strokeColor: 'blue',
        strokeOpacity: .3,
        strokeWeight: 0,
        strokePosition: google.maps.StrokePosition.OUTSIDE,
        scale: magnitude
    };
    return circle;
}
