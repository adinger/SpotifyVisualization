// CHANGE THIS INPUT FILE WHEN THE RADIO BUTTON FOR THE PLAYLIST IS CLICKED (MUST BE ON PUBLIC URL):
//var inputFile = "https://raw.githubusercontent.com/adinger/SpotifyVisualization/master/playlistA.json";   
var inputFile = "playlistA.json";

// Adjust the genres and colors. Make sure # genres = # colors!
var genreList = ["rock","r&b","punk","hip hop","grunge",
                "folk","christmas","celtic","ambient","soundtrack",
                "soul","classical","blues","contemporary"];
var colorList = ["#874b5a","#74a8ce","#6f5b4c","#d1aa76","#baa644",
                "#622f7e","#e0d16d","#1d7446", "#73ae88","#2c6a9f",
                "#d194a0","#384a99","#6a86b9","9f6ea2"];


$.when(
    $.getJSON(inputFile)
).done(function(jsonObject) {
    var lowestBPM = getLowestBpmInPlaylist(jsonObject);
    var highestBPM = getHighestBpmInPlaylist(jsonObject); // helps us set the highest color luminance

    var margin = {top: 350, right: 480, bottom: 350, left: 480},
        radius = Math.min(margin.top, margin.right, margin.bottom, margin.left) - 10;

    console.log(highestBPM);

    /*************** functions to adjust arc colors ****************/
    //var hue = d3.scale.category20();  // gives us 10 colors
    var hue = d3.scale.ordinal()
      .domain(genreList)
      .range(colorList);

    // maps an input domain to an output range representing luminance levels
    // See LAB Color Space: https://en.wikipedia.org/wiki/Lab_color_space
    var luminance = d3.scale.linear()   
        .domain([lowestBPM, highestBPM])
        .clamp(true)
        .range([140,70]); // higher = white, lower = black

    function fill(d) {  // calculates the fill color for each arc
      var parent = d;
      while (parent.depth > 1) parent = parent.parent;
      var c = d3.lab(hue(parent.name)); // LAB Color Space: https://en.wikipedia.org/wiki/Lab_color_space
      c.l = luminance(d.luminance);
      return c;
    }
    /******** end functions for adjusting arc colors ***********/

    var svg = d3.select("#chart").append("svg")
        .attr("width", margin.left + margin.right)
        .attr("height", margin.top + margin.bottom)
      .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var partition = d3.layout.partition()
        .sort(function(a, b) { return d3.ascending(a.name, b.name); })
        .size([2 * Math.PI, radius]);

    var arc = d3.svg.arc()
        .startAngle(function(d) { return d.x; })
        .endAngle(function(d) { return d.x + d.dx ; })
        .padAngle(.01)
        .padRadius(radius / 3)
        .innerRadius(function(d) { return radius / 3 * d.depth; })
        .outerRadius(function(d) { return radius / 3 * (d.depth + 1) - 1; });

    /********** create infowindows that shows when hovering over the arc *********/
    var centerTooltip = d3.select('#chart')
      .append('div')
      .attr('class', 'centerTooltip');
    var tooltip = d3.select('#chart')
      .append('div')
      .attr('class', 'tooltip');
    
                  
    centerTooltip.append('div') 
      .attr('class', 'label');

    centerTooltip.select('.label').html('Playlist: <b>'+inputFile+'</b>');
                  
    tooltip.append('div') 
      .attr('class', 'label');
    tooltip.append('div')
      .attr('class', 'info');

    /*********************** end infowindows ************************/

    d3.json(inputFile, function(error, root) {
      function calculateLuminance(d) {
        if (d.type === 'song') { // if song, value = bpm
            return d.bpm;
          } else if (d.type === 'bpmRange') { // if bpmRange, value = median bpm in this range
            // parse "100-110" bpm range
            bpmRange = d.name.split("-");
            lowBPM = parseInt(bpmRange[0]);
            highBPM = parseInt(bpmRange[1]);
            medianBPM = (lowBPM + highBPM) / 2;
            return medianBPM;
          } else if (d.type === 'genre') { // if genre, return the highest BPM in that genre
            return d3.max(d.children, function(bpmRangeObject) {
              //console.log(bpmRangeObject);
              var songs = bpmRangeObject.children;
              var bpmArray = [];
              for (var i=0; i < songs.length ; ++i)
                  bpmArray.push(songs[i]["bpm"]);
              return d3.max(bpmArray);
            });
          }
      }

      // Compute the initial layout on the entire tree to sum sizes.
      // Also compute the full name and fill color for each node,
      // and stash the children so they can be restored as we descend.
      partition
          .value(function(d) { return 1; })
          .nodes(root)            // returns array representing all nodes in the tree rooted at this root
          .forEach(function(d) {  // for each node in this tree, store some attributes
            d._children = d.children;
            d.sum = 1;
            d.luminance = calculateLuminance(d);
            //alert("Name: "+d.name);
            d.key = key(d);
            d.fill = fill(d);   // SET THE ARC'S COLOR HERE
          });

      // Now redefine the value function to use the previously-computed sum.
      partition
          .children(function(d, depth) { return depth < 2 ? d._children : null; })
          .value(function(d) { return d.sum; });

      var center = svg.append("circle")
          .attr("r", radius / 3)
          .on("click", zoomOut);

      center.append("title")
          .text("zoom out");

      var path = svg.selectAll("path")
          .data(partition.nodes(root).slice(1))
        .enter().append("path")
          .attr("d", arc)
          .style("fill", function(d) { return d.fill; })
          .each(function(d) { this._current = updateArc(d); })
          .on("click", zoomIn);

      addMouseListeners(path);    // reattach mouse listeners for arcs
      //addCenterMouseListeners(path);

      function hasOwnProperty(obj, prop) {
          var proto = obj.__proto__ || obj.constructor.prototype;
          return (prop in obj) &&
              (!(prop in proto) || proto[prop] !== obj[prop]);
      }

      // animation functions

      function zoomIn(p) {
        if (p.depth > 1) p = p.parent;
        if (!p.children) return;
        zoom(p, p);
        console.log('zoomin');
        setCenterTooltip(p);
      }

      function zoomOut(p) {
        if (!p.parent) return;
        zoom(p.parent, p);
        console.log('zoomout');
        setCenterTooltip(p.parent);
      }

      function setCenterTooltip(currentArc) {
        if (currentArc.name === 'music') {
          centerTooltip.select('.label').html('Playlist: <b>'+inputFile+'</b>');
        } if (currentArc.type === 'genre') {
          centerTooltip.select('.label').html('Current Genre: <b>'+capitalizeFirstLetter(currentArc.name)+'</b>');
        } else if (currentArc.type === 'bpmRange') {
          centerTooltip.select('.label').html('Current BPM Range: <b>'+currentArc.name+'</b>');
        }
      }

      // Zoom to the specified new root.
      function zoom(root, p) {
        
        if (document.documentElement.__transition__) return;

        // Rescale outside angles to match the new layout.
        var enterArc,
            exitArc,
            outsideAngle = d3.scale.linear().domain([0, 2 * Math.PI]);

        function insideArc(d) {
          return p.key > d.key
              ? {depth: d.depth - 1, x: 0, dx: 0} : p.key < d.key
              ? {depth: d.depth - 1, x: 2 * Math.PI, dx: 0}
              : {depth: 0, x: 0, dx: 2 * Math.PI};
        }

        function outsideArc(d) {
          return {depth: d.depth + 1, x: outsideAngle(d.x), dx: outsideAngle(d.x + d.dx) - outsideAngle(d.x)};
        }

        center.datum(root);

        // When zooming in, arcs enter from the outside and exit to the inside.
        // Entering outside arcs start from the old layout.
        if (root === p) enterArc = outsideArc, exitArc = insideArc, outsideAngle.range([p.x, p.x + p.dx]);

        path = path.data(partition.nodes(root).slice(1), function(d) { return d.key; });

        // When zooming out, arcs enter from the inside and exit to the outside.
        // Exiting outside arcs transition to the new layout.
        if (root !== p) enterArc = insideArc, exitArc = outsideArc, outsideAngle.range([p.x, p.x + p.dx]);

        d3.transition().duration(d3.event.altKey ? 7500 : 750).each(function() {
          path.exit().transition()
              .style("fill-opacity", function(d) { return d.depth === 1 + (root === p) ? 1 : 0; })
              .attrTween("d", function(d) { return arcTween.call(this, exitArc(d)); })
              .remove();

          path.enter().append("path")
              .style("fill-opacity", function(d) { return d.depth === 2 - (root === p) ? 1 : 0; })
              .style("fill", function(d) { return d.fill; })
              .on("click", zoomIn)
              .each(function(d) { this._current = enterArc(d); });

          path.transition()
              .style("fill-opacity", 1)
              .attrTween("d", function(d) { return arcTween.call(this, updateArc(d)); });
        });

        addMouseListeners(path);
        //addCenterMouseListeners(path);
      }
    });

    function addCenterMouseListeners(path) {
      path.on('click', function(d) {
        if (d.type === 'genre') {
          centerTooltip.select('.label').html('Showing BPMs under "'+d.name+'" genre');
        } else if (d.type === 'bpmRange') {
          centerTooltip.select('.label').html('Showing songs under "'+d.name+'" BPM range');
        }
      });
    }


    // adds the mouseover, mouseout, and mousemove events for each arc
    function addMouseListeners(path) {
      path.on('mouseover', function(d) {
        if (d.type === 'genre') {
          tooltip.select('.label').html('Genre: <b>'+capitalizeFirstLetter(d.name)+'</b>');
          tooltip.select('.info').html('');
        } else if (d.type === 'song') {
          tooltip.select('.label').html('Song: <b>'+d.name+'</b>');
          tooltip.select('.info').html('BPM: <b>'+d.bpm+'</b>');
        } else if (d.type === 'bpmRange') {
          tooltip.select('.label').html('BPM Range: <b>'+d.name+'</b>');
          tooltip.select('.info').html('Song Count: <b>'+d._children.length+'</b>');
        }
        tooltip.style('display', 'block'); 
      });
      
      path.on('mouseout', function() {
        tooltip.style('display', 'none');
      });  

      path.on('mousemove', function(d) {  // makes the infowindow follow the mouse around
        tooltip.style('top', (d3.event.pageY + 10) + 'px')
          .style('left', (d3.event.pageX + 10) + 'px');
      });
      
    }

    function key(d) {
      var k = [], p = d;
      while (p.depth) k.push(p.name), p = p.parent;
      return k.reverse().join(".");
    }

    function arcTween(b) {
      var i = d3.interpolate(this._current, b);
      this._current = i(0);
      return function(t) {
        return arc(i(t));
      };
    }

    function updateArc(d) {
      return {depth: d.depth, x: d.x, dx: d.dx};
    }


    d3.select(self.frameElement).style("height", margin.top + margin.bottom + "px");

    // helper to capitalize genre name
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // gets the LOWEST BPM in the whole playlist. helps to set the maximum color luminance.
    function getLowestBpmInPlaylist(jsonObject) {
      var ret;
      var root = jsonObject;
      ret = d3.min(root.children, function(genreObject) {
        var minGenreBpm = d3.min(genreObject.children, function(bpmRangeObject) {
          //console.log(bpmRangeObject);
          var songs = bpmRangeObject.children;
          var bpmArray = [];
          for (var i=0; i < songs.length ; ++i)
              bpmArray.push(songs[i]["bpm"]);
          return d3.min(bpmArray);
        });
        //console.log("minGenreBpm: "+minGenreBpm);
        return minGenreBpm;
      });
      return ret;
    }

    // gets the highest BPM in the whole playlist. helps to set the maximum color luminance.
    function getHighestBpmInPlaylist(jsonObject) {
      var ret;
      var root = jsonObject;
      ret = d3.max(root.children, function(genreObject) {
        var maxGenreBpm = d3.max(genreObject.children, function(bpmRangeObject) {
          //console.log(bpmRangeObject);
          var songs = bpmRangeObject.children;
          var bpmArray = [];
          for (var i=0; i < songs.length ; ++i)
              bpmArray.push(songs[i]["bpm"]);
          return d3.max(bpmArray);
        });
        //console.log("maxGenreBpm: "+maxGenreBpm);
        return maxGenreBpm;
      });
      return ret;
    }

});