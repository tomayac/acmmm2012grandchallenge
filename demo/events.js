(function() {
  var GOOGLE_API_KEY = 'AIzaSyC5GxhDFxBHTKCLNMYtYm6o1tiagi65Ufc';
  var EVENTFUL_KEY = 'd9RP52FGRhfSrvwN';
  
  var searchButton = document.getElementById('do_search');
  var locationInput = document.getElementById('location_search');
  var locationSection = document.getElementById('location_lat_long');
  var eventsSection = document.getElementById('events');

  searchButton.addEventListener('click', function() {
    console.log('SUBMIT')
    var location = locationInput.value;
    if (location) {
      geocode(location);
    }
    return false;
  }, false);  
  
  function geocode(location) {
    var url = 'https://maps.googleapis.com/maps/api/geocode/json';
    var sensor = '?sensor=false';
    var address = '&address=' + encodeURIComponent(location);
    url += sensor + address;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          var data = JSON.parse(xhr.responseText);          
          retrieveGeocodeResults(data);
        } else {
          console.log('Error: Geocoding of the location failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();    
  }
  
  function retrieveGeocodeResults(data) {
    if (data.results && data.results.length > 0) {
      var location = data.results[0];
      var coords = location.geometry.location;
      getPlaces(coords.lat, coords.lng, 'club');
      getEvents(coords.lat, coords.lng, '', location.formatted_address);
      locationInput.value = location.formatted_address;
      /*
      locationSection.innerHTML = 
          '<strong>' + location.formatted_address + '</strong>' + 
          '<br/>Latitude: ' +          
          '<span class="coords">' + coords.lat + '</span>' + 
          '<br/>Longitude: ' +
          '<span class="coords">' + coords.lng + '</span>';
      */    
    } else {
      // TODO: error handling
    }
  }
  
  function getEvents(lat, long, query, formattedAddress) {
    var url = 'http://api.eventful.com/rest/events/search';
    var authentication = '?app_key=' + EVENTFUL_KEY;
    var keywords = '&keywords=' + encodeURIComponent(query);
    var location = '&location=' + lat + ',' + long;
    var category = '&category=music,festivals_parades,singles_social';
    var date = '&date=Last+Week';
    var within = '&within=1';
    var units = '&units=km';
    var mature = '&mature=all';
    url += authentication + keywords + location + category + date + within +
        units + mature;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {          
          retrieveEventsResults(xhr.responseXML, formattedAddress);
        } else {
          console.log('Error: Getting events for the coordinates failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();        
  }
  
  function retrieveEventsResults(data, formattedAddress) {
    var events = data.getElementsByTagName('event');
    var html = '';
    for (var i = 0, len = events.length; i < len; i++) {
      var e = events[i];
      var title = e.getElementsByTagName('title')[0].textContent;
      var start = e.getElementsByTagName('start_time')[0].textContent;
      var commonLocation = formattedAddress.split(',')[0];
      var eventId = 'event_' + i;
      getMediaItems(title, commonLocation, eventId);
      try {
        var image =
            e.getElementsByTagName('image')[0].getElementsByTagName('url')[0].textContent;
      } catch(e) {
        
      }            
      html += 
          '<div id="' + eventId + '" class="event">' +
            '<strong>' + title + '</strong><br/>' +
            '<time>' + start + '</time><br/>' + 
            '<img src="' + image + '" />' +
          '</div>';
    }
    eventsSection.innerHTML = html;
  }
  
  function getPlaces(lat, long, query) {    
    var url = 'https://maps.googleapis.com/maps/api/place/search/json';
    var radius = '?radius=1000';
    var sensor = '&sensor=false';
    var location = '&location=' + lat + ',' + long;
    var keyword = '&keyword=' + encodeURIComponent(query);
    var key = '&key=' + GOOGLE_API_KEY;
    url += radius + sensor + location + keyword + key;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          var data = JSON.parse(xhr.responseText);          
          retrievePlacesResults(data);
        } else {
          console.log('Error: Getting places for the coordinates failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();
  }
  
  function retrievePlacesResults(data) {
    if (data.results && data.results.length > 0) {    
      // eventsSection.innerHTML += JSON.stringify(data.results, null, '  ');
    } else {
      // TODO: error handling
    }
  }
  
  function getMediaItems(title, commonLocation, eventId) {
    var url = 'http://media.no.de/search/combined/';
    url += encodeURIComponent('"' + title + '" ' + commonLocation);
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          var data = JSON.parse(xhr.responseText);          
          retrieveMediaItemsResults(data, eventId);
        } else {
          console.log('Error: Getting media items for the query failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();
  }
  
  function retrieveMediaItemsResults(data, eventId) {
    var eventDiv = document.getElementById(eventId);
    var socialNetworks = Object.keys(data);
    socialNetworks.forEach(function(socialNetwork) {
      var media = data[socialNetwork];
      media.forEach(function(medium) {
        if (!medium.type === 'photo') {
          return;
        }
        eventDiv.innerHTML +=
            '<br/><img class="event_media" src="' + medium.mediaurl +'" />';
      });
    });
  }
  
})();