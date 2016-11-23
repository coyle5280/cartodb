(function() {

  /*
  * Filter's model
  *
  **/

  cdb.admin.mod.Filter = cdb.core.View.extend({

    _SHORT_MONTH_NAMES: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    _MONTH_NAMES: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],

    tagName: 'li',
    className: 'filter histogram',

    events: {
      'click a.remove'              :  '_remove',
      'focus  .range-number input'  :  '_onNumberFilterFocused',
      'blur   .range-number input'  :  '_hideNumberField',
      'change .range-number input'  :  '_onNumberFilterChanged',
      'click  .toggleButton'        :  '_toggle',
      'click  .range-text'          :  '_showRangeInput',
      'click  .range-date-text'     :  '_showDateRangeInput',
      'click  .date-min'            :  '_showCalenderMin',
      'focus  .date-min'            :  '_showCalenderMin',
      'click  .date-max'            :  '_showCalenderMax',
      'focus  .date-max'            :  '_showCalenderMax'
    },

    initialize: function() {
      _.bindAll(this, "_barChart");
      this.model.bind('change:hist',  this.render,  this);
      this.model.bind('change:lower', this._renderRange, this);
      this.model.bind('change:upper', this._renderRange, this);
      this.model.bind('error',        this._checkEmpty,  this);

      this.isDate = (this.model.get("column_type") == 'date');
      this.isNumber = (this.model.get("column_type") == 'number');
      this.calOpen = false;
      this.calInputSelect = null;
      if (this.isDate) {
        this.$el.addClass('date');
      }
      cdb.god.on('closeDialogs', function(){
        this.calOpen = false;
        this.calender.hide();
        this.$el.find('.range').hide();
        this.$el.find('.range-date-text').show();
      }.bind(this));
      this._setupCalender();
    },

    _renderHist: function() {
      var self = this;

      var histData = this.model.get('hist');

      if(!histData) return;

      if (histData.length == 1) {
        var M = histData.length;

        this.$el.find(".legend").html(this._cleanString(this._getColumnName(), 15) + ":");

        this.$(".loading").hide();
        this.$(".empty").hide();
        this.$(".range").hide();
        this.$(".range-number").hide();
        this.$(".only").fadeIn(150);

        return;
      }

      this._checkEmpty();
      this._setupCalender();
      var data = histData.map(function(x, i) {
        return { value: x };
      });
      var filter = crossfilter(data);

      var dim = function(k) {
        return filter.dimension(function (d) {
          return d[k];
        });
      }

      var def = function(k) {

        var dimK  = dim(k);

        var width = 332;

        var lower = self.model.get("lower");
        var upper = self.model.get("upper");

        // Inverse interpolation
        var span = self.model.get("upper_limit") - self.model.get("lower_limit")
        var bar_size = span/data.length;
        var l = (lower - self.model.get("lower_limit")) * data.length / span;
        var u = (upper - self.model.get("lower_limit")) * data.length / span;

        return self._barChart()
        .dimension(dimK)
        .group(data.map(function(d) { return parseFloat(d.value, 10); }))
        .round(function(v) {
          return Math.ceil(v);
        })
        .x(
          d3.scale.linear()
          .domain([0, data.length])
          .range([0, width])
        )
        .filter([l, u])
      }

      var chartDefs = [def('value')];

      var chartDivs = d3.select(".hist." + this.cid)
      .data(chartDefs)
      .each(function(chartDiv) {
        chartDiv.on("brush", renderAll).on("brushend", renderAll);
      });

      function renderAll() {
        chartDivs.each(function(method) {
          d3.select(this).call(method);
        });
      }
      cdb.god.on('closeDialogs', function(){
        // this.calender.hide();
      }.bind(this));
      renderAll();

    },

    _setupCalender: function() {
      this.$el.find(".ui-datepicker-div").hide();
      this.calender = this.$el.find(".ui-datepicker-div")
          .datepicker({
              changeMonth: true,
              changeYear: true,
              rangeSelect: true,
              numberOfMonths: 1,
              onSelect: function(dateText, inst) {
                if(this.calInputSelect === 'max'){
                  this.model.set('upper', new Date(dateText).getTime());
                  var dateSelected = this.model._getDateFromTimestamp(dateText);
                  var maxVal = this._formatDate(dateSelected, dateSelected).max;
                  this.$el.find('.date-max').val(maxVal);
                  this.calender.hide();
                  this.$el.find('.range').hide();
                  // this.$('.range-date-text').html($('.date-min').val + " - " + maxVal);
                }else{
                  this.model.set('lower', new Date(dateText).getTime());
                  var dateSelected = this.model._getDateFromTimestamp(dateText);
                  var minVal = this._formatDate(dateSelected, dateSelected).min;
                  this.$el.find('.date-min').val(minVal);
                  this.$el.find('.date-max').focus();
                  // this.$('.range-date-text').html(minVal + " - " + $('.date-max').val);
                }
              }.bind(this),
              beforeShow: function(input) {
                  // if (window.fieldFlag === 0) {

                  //       $("#ui-datepicker-div td").off();

                  //       if (selectedDate != null) {
                  //           $('#from').datepicker('option', 'minDate', selectedDate).datepicker('refresh');
                  //       }
                  //   }
                  //   if (window.fieldFlag === 1) {

                  //       $("#ui-datepicker-div td").on({
                  //           mouseenter: function() {
                  //               $(this).parent().addClass("finalRow");
                  //               $(".finalRow").prevAll().find("td:not(.ui-datepicker-unselectable)").addClass("highlight");
                  //               $(this).prevAll("td:not(.ui-datepicker-unselectable)").addClass("highlight");
                  //       },
                  //           mouseleave: function() {
                  //               $(this).parent().removeClass("finalRow");
                  //               $("#ui-datepicker-div td").removeClass("highlight");
                  //           }
                  //       });

                  //       var selectedDate = $("#from").datepicker("getDate");                
                  //       if (selectedDate != null) {
                  //           $('#to').datepicker('option', 'minDate', selectedDate).datepicker('refresh');
                  //       }
                  //   }
              },
              beforeShowDay: function (date) {
                if(this.$el.find('.date-min').val() && this.$el.find('.date-max').val()){
                  if(new Date(this.$el.find('.date-min').val()) < date && date < new Date(this.$el.find('.date-max').val())){
                    return [true, "ui-state-highlight"];
                  }else{
                    return [true, ""];
                  }
                }else{
                  return [true, ""];
                }
            }.bind(this)
            });
    },

    _showCalenderMax: function(e){
      e.preventDefault();
      e.stopPropagation();
      this.calInputSelect = 'max';
      this.calOpen = true;
      this.calender.datepicker('setDate', new Date($('.date-max').val()));
      this.calender.show();
    },

    _showCalenderMin: function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.calInputSelect = 'min';
      this.calOpen = true;
      this.calender.datepicker('setDate', new Date($('.date-min').val()));
      this.calender.show();
    },

    _hideCalender: function(){
      if(this.calOpen){
        this.calOpen = false;
        this.calender.hide();
      }
    },

    _showDateRangeInput: function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.$('.range').show();
      this.$('.range-date-text').hide();
    },

    render: function() {

      var self = this;

      this.$el.html(this.getTemplate('table/menu_modules/filters/templates/histogram')({
        legend: this._getColumnName(),
        alias: this._getColumnAlias(),
        cid: self.cid
      }));
      this._renderHist();
      return this;
    },

    _hideNumberField: function(e){
      setTimeout(function(){
        if(this.$('.range-number .max').is(':focus') || this.$('.range-number .min').is(':focus')){
          return
        }else{
          this.$('.range-number').hide();
          this.$('.range-text').show();
        }
      }.bind(this), 200);
    },
    
    _showRangeInput: function(){
      this.$('.range-number').show();
      this.$('input.min').focus();
      this.$('.range-text').hide();
    },

    _cleanString: function(s, n) {

      if (s) {
        s = s.replace(/<(?:.|\n)*?>/gm, ''); // strip HTML tags
        s = s.substr(0, n-1) + (s.length > n ? '&hellip;' : ''); // truncate string
      }

      return s;

    },

    _toggle: function() {
      $(this.$el.find('.hist.' + this.cid)).toggle();
    },

    _checkEmpty: function() {

      var self = this;

      setTimeout(function() {

        var hist = self.model.get("hist");

        if (hist) {

          if (hist.length > 1) {

            self.$(".empty").hide();
            self.$(".loading").hide();

            self.$(".only").hide();
            if (this.isNumber) {
              self.$(".range-number").fadeIn(250);
            } else {
              // self.$(".range").fadeIn(250);
            }
          } else {

            self.$el.find(".legend").html(self.model.escape('column'));

            self.$(".loading").hide();
            self.$(".range").hide();
            self.$(".range-number").hide();
            self.$(".empty").hide();
            self.$(".only").fadeIn(150);
          }
        } else {

          self.$el.find(".legend").html(self._cleanString(self.model.escape('column'), 25) + ":");

          self.$(".range").hide();
          self.$(".range-number").hide();
          self.$(".loading").hide();
          self.$(".empty").fadeIn(150);
        }}
      , 250);

      },

    _getMinMaxFromDate: function(lower, upper) {

      var min, max;

      lower = Math.round(lower);
      upper = Math.round(upper);

      var min_date = this.model._getDateFromTimestamp(lower);
      var max_date = this.model._getDateFromTimestamp(upper);

      var minMaxDate = this._formatDate(min_date, max_date);

      return { min: minMaxDate.min, max: minMaxDate.max };

    },

    _formatLowerUpper: function(lower, upper) {
      return { min: lower.toPrecision( Math.round(lower).toString().length + 2), max: upper.toPrecision( Math.round(upper).toString().length + 2) };
    },

    _getColumnName: function() {
      if (this.model.table.get('synchronization') && this.model.table.get('synchronization').from_external_source) {
        return Sugar.String.titleize(this.model.escape('column'));
      }
      return this.model.escape('column');
    },

    _getColumnAlias: function() {
      if (this.model.table.get('synchronization') && this.model.table.get('synchronization').from_external_source) {
        var alias = this.model.escape('alias');
        if(alias) return Sugar.String.titleize(this.model.escape('alias'));
        return null;
      }
      return (this.model.escape('alias')) ? this.model.escape('alias') : null;
    }, 

    _renderRange: function() {
      var lower = this.model.get('lower');
      var upper = this.model.get('upper');
      if (_.isNaN(upper) || _.isNaN(lower)) { return; }

      var minMax = {};

      if (this.isDate) {
        minMax = this._getMinMaxFromDate(lower, upper);
      } else {
        minMax = this._formatLowerUpper(lower, upper);
      }
      this.dateRange = minMax;
      this.upper = upper;
      this.lower = lower;
      this._renderRangeText(upper, lower, minMax);
    },

    _renderRangeText: function (upper, lower, minMax) {
      if (!_.isNaN(upper) && !_.isNaN(lower)) {
        if (this.isNumber) {
          // this.$('.range').hide();
          this.$('.range-date-text').hide();
          this.$('.range-number input.min').val(minMax.min);
          this.$('.range-number input.max').val(minMax.max);
          this.$('.range-text').html(minMax.min + '-' + minMax.max);
        } else {
          this.$('.range-number').hide();
          this.$('.range-date-text').html(minMax.min + " - " + minMax.max);
          this.$('.date-min').val(minMax.min);
          this.$('.date-max').val(minMax.max);
          this.calender.datepicker( "option", "maxDate", new Date(this.model.getUpperLimit()));
          this.calender.datepicker( "option", "minDate", new Date(this.model.getLowerLimit()));
          this.$('.range-date-text').show();
          // this.$('.range').show();
        }
        // this._renderHist();
      }
    },

    _onNumberFilterFocused: function () {
        this.$('.range-number .subtext').show();
    },

    _onNumberFilterChanged: function (event) {
        var $input = $(event.target);
        var value = parseFloat($input.val());
        var isMin = $input.hasClass('min');
        var modelKey = isMin ? 'lower' : 'upper';
        if (!isNaN(value)) {
          var lower = this.model.get('lower');
          var upper = this.model.get('upper');
          var lowerLimit = this.model.get('lower_limit');
          var upperLimit = this.model.get('upper_limit');
          if (value < lowerLimit) { value = lowerLimit; }
          if (value > upperLimit) { value = upperLimit; }
          // Swap lower/upper if input value is in lower and is greater than upper
          if (isMin && value > upper) {
            this.model.set('upper', value);
            value = upper;
          }
          // Swap lower/upper if input value is in upper and is less than lower
          if (!isMin && value < lower) {
            this.model.set('lower', value);
            value = lower;
          }
          this.model.set(modelKey, value);
          this._renderHist();
        } else {
          $input.val(this.model.get(modelKey));
        }
        this.$('.range-number .subtext').hide();
    },

    _remove: function(e) {
      e.preventDefault();
      e.stopPropagation();

      this.model.destroy();
    },

    _updateBounds:function(bounds, update) {
      if (bounds) {

        var n = this.model.get("hist").length;
        var lower = this.model.interpolate(bounds[0]/n);
        var upper = this.model.interpolate(bounds[1]/n);
        if (update) {
          if (!_.isNaN(lower)) this.model.set('lower', lower);
          if (!_.isNaN(upper)) this.model.set('upper', upper);
        }
        var minMax = null;
        if (this.isDate) {
          minMax = this._getMinMaxFromDate(lower, upper);
        } else {
          minMax = this._formatLowerUpper(lower, upper);
        }
        this._renderRangeText(upper, lower, minMax);
      }
    },

    _formatDate: function(min_date, max_date) {

      function get_nth_suffix(date) {
        switch (date) {
          case 1:
          case 21:
          case 31:
            return 'st';
          case 2:
          case 22:
            return 'nd';
          case 3:
          case 23:
            return 'rd';
          default:
            return 'th';
        }
      }

      function pad(n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
      }

      var minDay = min_date.getDate();
      var maxDay = max_date.getDate();

      var minYear = min_date.getFullYear();
      var maxYear = max_date.getFullYear();

      var minMonth = min_date.getMonth();
      var maxMonth = max_date.getMonth();

      var minTime = pad(min_date.getHours(), 2) + ":" + pad(min_date.getMinutes(), 2) + " ";
      var minDate = pad(minDay, 2) + " " + this._SHORT_MONTH_NAMES[minMonth] + " " + minYear;

      var maxTime = pad(max_date.getHours(), 2) + ":" + pad(max_date.getMinutes(), 2) + " ";
      var maxDate = pad(maxDay, 2) + " " + this._SHORT_MONTH_NAMES[maxMonth] + " " + maxYear;

      // return { min: minDate + " @ " + minTime, max: maxDate + " @ " + maxTime }
      return { min: minDate, max: maxDate}

    },

    _calculateTicksNum: function(x){
      var axis = d3.svg.axis().scale(x).orient("bottom");
      var ticks = [];
      var bucketSize = (this.model.getUpperLimit() - this.model.getLowerLimit())/4;
      ticks.push(this.model.getLowerLimit());
      if(bucketSize > 1){
        ticks.push(Math.ceil(bucketSize) + this.model.getLowerLimit());
        ticks.push(Math.ceil(bucketSize * 2) + this.model.getLowerLimit());
        ticks.push(Math.ceil(bucketSize * 3) + this.model.getLowerLimit());
        ticks.push(this.model.getUpperLimit());
        axis.tickValues(ticks).tickFormat(function(d) {return d});
      }else{
        ticks.push(bucketSize) + this.model.getLowerLimit();
        ticks.push(bucketSize * 2) + this.model.getLowerLimit();
        ticks.push(bucketSize * 3) + this.model.getLowerLimit();
        ticks.push(this.model.getUpperLimit());
        axis.tickValues(ticks).tickFormat(d3.format(".2n"));
      }
      return axis;
    },

    _getAxis: function(x) {
      if(this.isNumber){
          return this._calculateTicksNum(x);
          // xAxis.ticks(5).tickFormat(d3.format(",.0f"));
      }else if(this.isDate){
          return this._calculateTicksDate(x);
      }
    },

    _calculateTicksDate: function(x){
      var axis = d3.svg.axis().scale(x).orient("bottom");
      var ticks = [1, 2, 3, 4, 5];
      var bucketSize = 332/4;
      return axis.tickValues(ticks).tickFormat(function(d, idx) {
        var bucketSize = (this.getUpperLimit() - this.getLowerLimit())/4;
        switch (idx) {
          case 0:
            return (new Date(this.getLowerLimit()).toLocaleDateString())
          case 1:
            return (new Date(bucketSize + this.getLowerLimit()).toLocaleDateString())
          case 2:
            return (new Date(bucketSize * 2 + this.getLowerLimit()).toLocaleDateString())
          case 3:
            return (new Date(bucketSize * 3 + this.getLowerLimit()).toLocaleDateString())
          case 4:
            return new Date(this.getUpperLimit()).toLocaleDateString();
        }
      }.bind(this.model));
    },

    _barChart: function() {

      var self = this;

      var minHeight     = 97,
          margin        = {top: 0, right: 10, bottom: 0, left: 10},
          x             = d3.scale.ordinal().domain([1, 2, 3, 4, 5]).rangePoints([0, 332]),
          x_date        = d3.scale.ordinal().domain([1, 2, 3, 4, 5]).rangePoints([0, 332]),
          y             = d3.scale.linear().range([100, 0]),
          id            = this.cid,
          brush         = d3.svg.brush(),
          brushDirty,
          dimension,
          group,
          round,
          initialBounds = [];

      function chart(div) {

        var
          width  = x.range()[ x.range().length -1 ],
          height = y.range()[0];

        y.domain([0, d3.max(group)]);

        div.each(function(el, idx) {

          var div = d3.select(this),
          g = div.select("g");

          // Create the skeletal chart.
          if (g.empty()) {
            g = div.append("svg")
              .attr("width", width + margin.left + margin.right)
              .attr("height", height + margin.top + margin.bottom + 25)
              .append("g")
              .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            g.append("clipPath")
              .attr("id", "clip-" + id)
              .append("rect")
              .attr("width", width)
              .attr("height", height);

            g.selectAll(".bar")
              .data(['background', 'foreground'])
              .enter().append("path")
              .attr("class", function(d) { return d + " bar"; })
              .data([group, group])
            // var xAxis = d3.svg.axis().scale(x).orient("bottom").tickValues(self._calculateTicks()).tickFormat(d3.format(",.0f"));
            if (this.isNumber) {
              var xAxis = self._getAxis(x);
            } else {
              // var xAxis = d3.svg.axis().scale(x_date);
              var xAxis = self._getAxis(x_date);
            }
            g.append("g")
              .attr("class", "x axis")
              .attr("transform", "translate(0," + height + ")")
              .call(function(a) {
                return xAxis(a)
              });

            g.selectAll(".foreground.bar")
              .attr("clip-path", "url(#clip-" + id + ")");

            // Initialize the brush component with pretty resize handles.
            var gBrush = g.append("g").attr("class", "brush").call(brush);
            gBrush.selectAll("rect").attr("height", height);
            gBrush.selectAll(".resize").append("path").attr("d", resizePath);
          }

          // Only redraw the brush if set externally.
          if (brushDirty) {

            brushDirty = false;
            g.selectAll(".brush").call(brush);

            if (brush.empty()) {
              g.selectAll("#clip-" + id + " rect")
                .attr("x", 0)
                .attr("width", width);
            } else {

              var extent = brush.extent();

              g.selectAll("#clip-" + id + " rect")
                .attr("x", x(extent[0]))
                .attr("width", x(extent[1]) - x(extent[0]));


              self._updateBounds(extent, false);

            }
          }

          g.selectAll(".bar").attr("d", barPath);

          if (self.isDate) {
            var txt = g.selectAll(".x text");
            txt[0][0].setAttribute("x", 15);
            txt[0][ txt[0].length - 1 ].setAttribute("x", -15);
          }
        });

        function barPath(h, i) {

          var path = [],
              i = -1,
              n = h.length,
              d;

          var barWidth = width/n;
          while (++i < n) {
            d = h[i];

            inverseHeight = y(d);
            if (inverseHeight > minHeight && inverseHeight < height ) inverseHeight = minHeight;
            path.push("M", x(i), ",", height, "V", inverseHeight, "h", barWidth, "V", height);
          }

          return path.join("");

        }

        function resizePath(d) {
          var e = +(d == "e"),
              x = e ? 1 : -1,
              y = height / 3;
          return "M" + (.5 * x) + "," + y
            + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6)
            + "V" + (2 * y - 6)
            + "A6,6 0 0 " + e + " " + (.5 * x) + "," + (2 * y)
            + "Z"
            + "M" + (2.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8)
            + "M" + (4.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8);
        }
      }

      brush.on("brushstart.chart", function() {
        var extent = brush.extent();
        initialBounds = [extent];
        self._updateBounds(extent, false);
      });

      brush.on("brush.chart", function() {

        var extent = brush.extent();

        if (initialBounds.length >= 2) {
          if (extent[0] === initialBounds[1][0]) {
            extent[0] = initialBounds[0][0];
          } else if (extent[1] === initialBounds[1][1]) {
            extent[1] = initialBounds[0][1];
          }

          var g = d3.select(this.parentNode);
          g.select("#clip-" + id + " rect")
            .attr("x", x(extent[0]))
            .attr("width", x(extent[1]) - x(extent[0]));

          self._updateBounds(extent, false);
        } else {
          initialBounds.push(extent);
        }

      });

      brush.on("brushend.chart", function() {
        var extent = brush.extent();
        if (initialBounds.length >= 2) {
          if (extent[0] === initialBounds[1][0]) {
            extent[0] = initialBounds[0][0];
          } else if (extent[1] === initialBounds[1][1]) {
            extent[1] = initialBounds[0][1];
          }

          brush.extent(extent);
          self._updateBounds(extent, true);
        }
      });

      chart.margin = function(_) {
        if (!arguments.length) return margin;
        margin = _;
        return chart;
      };

      chart.x = function(_) {
        if (!arguments.length) return x;
        x = _;
        brush.x(x);
        return chart;
      };

      chart.y = function(_) {
        if (!arguments.length) return y;
        y = _;
        return chart;
      };

      chart.dimension = function(_) {
        if (!arguments.length) return dimension;
        dimension = _;
        return chart;
      };

      chart.filter = function(_) {
        if (_) {
          brush.extent(_);
          dimension.filterRange(_);
        } else {
          brush.clear();
          dimension.filterAll();
        }
        brushDirty = true;
        return chart;
      };

      chart.group = function(_) {
        if (!arguments.length) return group;
        group = _;
        return chart;
      };

      chart.round = function(_) {
        if (!arguments.length) return round;
        round = _;
        return chart;
      };

      return d3.rebind(chart, brush, "on");
    }

  });

})();
