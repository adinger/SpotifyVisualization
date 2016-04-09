// CHANGE THIS INPUT FILE WHEN THE RADIO BUTTON FOR THE PLAYLIST IS CLICKED:
var inputFile = "playlistA.json";   
var highestBPM = getHighestBpmInPlaylist(inputFile); // might change depending on dataset


var margin = {top: 350, right: 480, bottom: 350, left: 480},
    radius = Math.min(margin.top, margin.right, margin.bottom, margin.left) - 10;

function getHighestBPM(inputFile) {
  var c = d3.json(inputFile, function (error, root) {
    return root.name;
    //return d3.max(root.children);
  });
  alert(c);
  return c;
}

console.log(highestBPM);

/////////////////// functions for adjusting arc colors ///////////////////

var hue = d3.scale.category10();  // gives us 10 colors. for 20 colors, use d3.scale.category20().

var luminance = d3.scale.sqrt()   // brightness of color
    .domain([0, highestBPM])
    .clamp(true)
    .range([140, 70]);

function fill(d) {  // calculates the fill color for each arc
  var parent = d;
  while (parent.depth > 1) parent = parent.parent;
  var c = d3.lab(hue(parent.name)); // https://en.wikipedia.org/wiki/Lab_color_space
  c.l = luminance(d.luminance);
  return c;
}
//////////////////// end functions for colors ///////////////////////////////

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

////////// label that shows when hovering over the arc ///////////
var tooltip = d3.select('#chart')
  .append('div')
  .attr('class', 'tooltip');
              
tooltip.append('div') 
  .attr('class', 'label');

tooltip.append('div')
  .attr('class', 'info');
//////////////////////////////////////////////////////////////////

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

  addMouseListeners(path);

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
  }

  function zoomOut(p) {
    if (!p.parent) return;
    zoom(p.parent, p);
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
  }
});

// gets the maximum BPM in the whole file


// adds the mouseover, mouseout, and mousemove events for each arc
function addMouseListeners(path) {
  path.on('mouseover', function(d) {
    if (d.type === 'genre') {
      tooltip.select('.label').html('Genre: '+capitalizeFirstLetter(d.name));
      tooltip.select('.info').html('');
    } else if (d.type === 'song') {
      tooltip.select('.label').html('Song: '+d.name);
      tooltip.select('.info').html('BPM: '+d.bpm);
    } else if (d.type === 'bpmRange') {
      tooltip.select('.label').html('BPM Range: '+d.name);
      tooltip.select('.info').html('Song Count: '+d._children.length);
    }
    tooltip.style('display', 'block'); 
  });
  
  path.on('mouseout', function() {
    tooltip.style('display', 'none');
  });  

   
  path.on('mousemove', function(d) {
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

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

d3.select(self.frameElement).style("height", margin.top + margin.bottom + "px");


function getHighestBpmInPlaylist(inputFile) {
  var ret;
  var root = JSON.parse(inputFile);
  ret = d3.max(root.children, function(genreObject) {
    //console.log(genreObject);   
    var maxGenreBpm = d3.max(genreObject.children, function(bpmRangeObject) {
      //console.log(bpmRangeObject);
      var songs = bpmRangeObject.children;
      var bpmArray = [];
      for (var i=0; i < songs.length ; ++i)
          bpmArray.push(songs[i]["bpm"]);
      return d3.max(bpmArray);
    });
    console.log("maxGenreBpm: "+maxGenreBpm);
    return maxGenreBpm;
  });  
  console.log('ret:'+ret);
  return ret;
}