(function() {
  
  // keys for the various services
  var GOOGLE_API_KEY = 'AIzaSyC5GxhDFxBHTKCLNMYtYm6o1tiagi65Ufc';
  var EVENTFUL_KEY = 'd9RP52FGRhfSrvwN';
  var UPCOMING_KEY = 'cce931ba7e';
  var TELEPORTD_KEY = 'd8b1663cdc10753314d5a9bb77ee58fe';
  
  // this objects serves as a central "templating engine" for all generated HTML
  var htmlFactory = {
    // the container for an event
    event: function(eventId, title, start, image, source) {
      return  '<div id="' + eventId + '" class="event">' +
                '<strong class="event_title">' + title + '</strong><br/>' +
                '<span class="event_source">' + source + '</span><br/>' + 
                '<time class="event_time">' + start + '</time><br/>' + 
                '<img class="event_tiny_image" src="' + image + '" />' +
              '</div>';    
    },
    // the individual images that illustrate an event 
    media: function(mediaurl) {
      // elegant: if the image returns an error (like 404 or 403), it
      // automagically removes itself from the DOM rather than showing a "broken
      // image" icon
      return '<br/>' + 
             '<img class="event_media" ' + 
             'onerror="javascript:this.parentNode.removeChild(this);" ' + 
             'src="' + mediaurl +'" />';
    }
  };
  
  // get DOM access to the page elements
  var searchButton = document.getElementById('do_search');
  var locationInput = document.getElementById('location_search');
  var eventsSection = document.getElementById('events');
  var spinnerImage =  document.getElementById('spinner');
  
  // needed to store existing events when working with multiple event sources
  // in order to avoid event duplication
  var eventTitles = {};

  // add logic to the search button
  searchButton.addEventListener('click', function() {
    reset();
    spinnerImage.style.display = 'inline';
    searchButton.style.display = 'none';
    var location = locationInput.value;
    if (location) {
      geocode(location);
    }
    return false;
  }, false);
  
  // helper function needed to create unique IDs
  function createRandomId() {
    var text = '';
    var possible =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var possibleLength = possible.length;
    for (var i = 0; i < 5; i++) {
      text += possible.charAt(Math.floor(Math.random() * possibleLength));
    }
    return text;
  }

  // resets the GUI and central variables
  function reset() {
    eventsSection.innerHTML = '';
    eventTitles = {};
  }
  
  // gets the lat/long pair and sanitized location name for a location query
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
  
  // retrieves lat/long pair and sanitized location name for a location query
  // gets events for a lat/long pair from different event sources
  function retrieveGeocodeResults(data) {
    spinnerImage.style.display = 'none';
    searchButton.style.display = 'inline';
    
    if (data.results && data.results.length > 0) {
      var location = data.results[0];
      var coords = location.geometry.location;
      getPlaces(coords.lat, coords.lng, '');
      getEventfulEvents(coords.lat, coords.lng, '', location.formatted_address);
      getUpcomingEvents(coords.lat, coords.lng, '', location.formatted_address);
      locationInput.value = location.formatted_address;
    } else {
      // TODO: error handling
    }
  }
  
  // sanitizes an event's title by removing punctuation and shortening as
  // necessary
  // TODO: do more advanced sanitization for spammy titles with keyword stuffing
  function sanitizeEventTitle(title) {
    // remove punctuation and weird characters
    title = title.replace(
        /[\.,\-\?¿\/\\#!$€%\^\*;:{}=_`´'"~()®™\[\]“”…°<>]/g, '');
    // replace characters that can stand for "and" by space
    title = title.replace(/[&\+]/g, ' ');
    return title
  }
  
  // checks if an event with a similar title already exists from a different
  // event source
  // TODO: more advanced similarity checking, e.g., by calculating the
  // Levenshtein distance
  function eventWithSimilarTitleExists(title) {
    var lowerCaseTitle = title.toLowerCase();
    if (eventTitles[lowerCaseTitle]) {
      return true;
    }
    eventTitles[lowerCaseTitle] = true;
    return false;
  }
  
  // gets events from Upcoming
  function getUpcomingEvents(lat, long, query, formattedAddress) {
    var url =
        'http://upcoming.yahooapis.com/services/rest/?method=event.search';
    var apiKey = '&api_key=' + UPCOMING_KEY;
    var query = '&search_text=' + encodeURIComponent(query);
    var location = '&location=' + lat + ',' + long;
    var format = '&format=json';
    var limit = '&per_page=10';
    var date = '&quick_date=this_week';
    url += apiKey + query + location + format + limit + date;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {          
          var data = JSON.parse(xhr.responseText);                    
          retrieveUpcomingEventsResults(data, formattedAddress, lat, long);
        } else {
          console.log('Error: Getting Upcoming events for the coordinates failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();        
  }
    
  // retrieves events from Upcoming
  function retrieveUpcomingEventsResults(data, formattedAddress, lat, long) {
    if (!data.rsp) {
      return;
    }
    var events = data.rsp.event;
    for (var i = 0, len = events.length; i < len; i++) {
      var e = events[i];
      var title = sanitizeEventTitle(e.name);
      if (eventWithSimilarTitleExists(title)) {
        continue;
      }
      var start = e.start_date + ' ' + e.start_time;
      var commonLocation = formattedAddress.split(',')[0];
      var eventId = 'event_' + createRandomId();
      var image = e.photo_url;
      var eventHtml =
          htmlFactory.event(eventId, title, start, image, 'Upcoming');
      getMediaItems(title, commonLocation, lat, long, eventId, eventHtml);
    }
  }
  
  // gets events from Eventful
  function getEventfulEvents(lat, long, query, formattedAddress) {
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
          retrieveEventfulEventsResults(
              xhr.responseXML, formattedAddress, lat, long);
        } else {
          console.log('Error: Getting Eventful events for the coordinates failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();        
  }
  
  // retrieves events from Eventful
  function retrieveEventfulEventsResults(data, formattedAddress, lat, long) {
    var events = data.getElementsByTagName('event');
    for (var i = 0, len = events.length; i < len; i++) {
      var e = events[i];
      var title = sanitizeEventTitle(
          e.getElementsByTagName('title')[0].textContent);
      if (eventWithSimilarTitleExists(title)) {
        continue;
      }
      var start = e.getElementsByTagName('start_time')[0].textContent;
      var commonLocation = formattedAddress.split(',')[0];
      var eventId = 'event_' + createRandomId();
      var imageSrc = '';
      try {
        var image = e.getElementsByTagName('image')[0];
        imageSrc = image.getElementsByTagName('url')[0].textContent;
      } catch(e) {
        // TODO: Error handling
      }            
      var eventHtml =
          htmlFactory.event(eventId, title, start, imageSrc, 'Eventful');
      getMediaItems(title, commonLocation, lat, long, eventId, eventHtml);
    }
  }
  
  // gets (places and) events from Google Places
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
  
  // retrieves (places and) events from Google Places
  function retrievePlacesResults(data) {
    if (data.results && data.results.length > 0) {    
      // TODO: check for events
      // event data for places seems very sparse      
    } else {
      // TODO: error handling
    }
  }
  
  // gets media items for a given event title and/or lat/long pair
  function getMediaItems(title, commonLocation, lat, long, eventId, eventHtml) {
    getNodeMediaItems(title, commonLocation, eventId, eventHtml);
    getTeleportdMediaItems(title, lat, long, eventId, eventHtml);
  }

  // gets media items from Teleportd that match a given lat/long pair and event
  // title
  function getTeleportdMediaItems(title, lat, long, eventId, eventHtml) {
    var url = 'http://api.teleportd.com/search';
    var authentication = '?user_key=' + TELEPORTD_KEY;
    var location = '&loc=[' + lat + ',' + long + ',5.0,5.0]';
    var query = '&str=' + encodeURIComponent(title);
    url += authentication + location + query;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          var data = JSON.parse(xhr.responseText);
          retrieveTeleportdMediaItemsResults(data, eventId, eventHtml);
        } else {
          console.log('Error: Getting media items for the query failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();
  }
  
  // retrieves media items from Teleportd
  function retrieveTeleportdMediaItemsResults(data, eventId, eventHtml) {
    if (data.hits.length) {
      var eventDiv = document.getElementById(eventId);
      var html = '';
      data.hits.forEach(function(mediaItem) {
        if (mediaItem.typ === 'image') {
          html += htmlFactory.media(mediaItem.fll);
        }
      });
      eventDiv.innerHTML += html;
    }
  }
  
  // gets media items from our node.js Media Server that match a given event
  // title and sanitized location name
  function getNodeMediaItems(title, commonLocation, eventId, eventHtml) {
    var url = 'http://media.no.de/search/combined/';
    url += encodeURIComponent(title + '" ' + commonLocation);
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          var data = JSON.parse(xhr.responseText);          
          retrieveNodeMediaItemsResults(data, eventId, eventHtml);
        } else {
          console.log('Error: Getting media items for the query failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();
  }
  
  // retrieves media items from our node.js Media Server
  function retrieveNodeMediaItemsResults(data, eventId, eventHtml) {
    var socialNetworks = Object.keys(data);    
    // check if we have events at all, a bit ugly, but works
    var eventsExist = false;
    for (var i = 0, len = socialNetworks.length; i < len; i++) {
      var media = data[socialNetworks[i]];
      if (media.length) {
        eventsExist = true;
        break;
      }      
    }
    if (eventsExist) {      
      eventsSection.innerHTML += eventHtml;
      var eventDiv = document.getElementById(eventId);      
      var html = '';
      socialNetworks.forEach(function(socialNetwork) {
        var media = data[socialNetwork];
        media.forEach(function(mediaItem) {
          if (mediaItem.type === 'photo') {
            html += htmlFactory.media(mediaItem.mediaurl);
          }
        });
      });      
      eventDiv.innerHTML += html;
    }    
  }
  
})();