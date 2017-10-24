sap.ui.define([
	"it/interlem/sapui5TrainingTrainingDemo/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"it/interlem/sapui5TrainingTrainingDemo/model/formatter",
	"sap/viz/ui5/data/DimensionDefinition",
	"sap/viz/ui5/data/MeasureDefinition",
	"sap/viz/ui5/data/FlattenedDataset",
	"sap/viz/ui5/controls/common/feeds/FeedItem",
], function(BaseController, JSONModel, formatter, DimensionDefinition, MeasureDefinition, FlattenedDataset, FeedItem) {
	"use strict";

	return BaseController.extend("it.interlem.sapui5TrainingTrainingDemo.controller.Statistics", {
		
		formatter: formatter,
		
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit : function () {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy : false,
				delay : 0
			});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

			this.setModel(oViewModel, "detailView");
				
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched : function (oEvent) {
			var sObjectId =  oEvent.getParameter("arguments").objectId;
			this.getModel().metadataLoaded().then( function() {
				var sObjectPath = "/" + this.getModel().createKey("Customers", {
					CustomerID :  sObjectId
				});
				this._bindView(sObjectPath);
			}.bind(this));
			
			
		},

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView : function (sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");

			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);

			this.getView().bindElement({
				path : sObjectPath,
				parameters: {
					expand: 'Orders'
				},				
				events: {
					change : this._onBindingChange.bind(this),
					dataRequested : function () {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function (oEvent) {
						//oViewModel.setProperty("/busy", false);
					},
				}
			});
		},

		_onBindingChange : function (oEvent) {			
			//Refresh Chart model
			var sPath = oEvent.getSource().getPath() + '/Orders';
			var oModel = oEvent.getSource().getModel();
			oModel.read(
				sPath,
				{
					urlParameters: {
				        "$expand": "Order_Details"
				    },
					success: (function(oData, oResponse) { 
						this._chartRenderer(oData) }
					).bind(this)
				}
			);
		},
		
		_chartRenderer(oData) {
			var oViewModel = this.getModel("detailView");
			var oChartModelData = [];
			//Get total values by month
			for (var i=0;i<oData.results.length;i++) {
				var oOrder = oData.results[i];
				var orderMonth = new Date(oOrder.OrderDate.getFullYear(), oOrder.OrderDate.getMonth(), 1);
				var orderValue = 0;
				for (var j=0;j<oOrder.Order_Details.results.length;j++) {
					var oOrderItem = oOrder.Order_Details.results[j];
					orderValue = orderValue + ( oOrderItem.Quantity * oOrderItem.UnitPrice);
				}
				//Push values to month
				var monthExist = oChartModelData.filter(function( obj ) {
					  return obj.Month.getTime() === orderMonth.getTime();
				});
				if (monthExist[0]) {
					monthExist[0].Value = monthExist[0].Value + orderValue;
				} else {
					oChartModelData.push({
						Month: orderMonth,
						Value: orderValue
					})
				}
			}
			var oChartModel = new sap.ui.model.json.JSONModel({salesByMonth:oChartModelData});
			//Get vizframe
			var oVizFrame = this.getView().byId("idVizFrame");
			oVizFrame.setModel(oChartModel);
			oVizFrame.removeAllFeeds(); //Remove all feeds
			// Create dimension and measure
			var oDimension = new DimensionDefinition({
				name: 'Month',
				value: '{Month}',
				dataType: 'date'
			});
			var oMeasure = new MeasureDefinition({
				name: 'Sales',
				value: '{Value}'
			});
			//Chart dataset
			var oDataSet = new FlattenedDataset({
				dimensions: [oDimension],
				measures: [oMeasure],
				data: {
					path: "/salesByMonth"
				}
			});
			//Chart feeds
			var timeFeed = new FeedItem({
				uid: 'timeAxis',
				type: 'Dimension',
				values: ['Month']
			});
			var salesFeed = new FeedItem({
				uid: 'valueAxis',
				type: 'Measure',
				values: ['Sales']
			});
			
			oVizFrame.setDataset(oDataSet);
			oVizFrame.addFeed(timeFeed);
			oVizFrame.addFeed(salesFeed);
			
			oVizFrame.setVizProperties({
	        	timeAxis: {
	                levels: ["year", "month"],
	                title: {
	                    visible: false
	                }
	            },
	            valueAxis: {
	                title: {
	                    visible: false
	                }
	            },
	            title: {
	                visible: false
	            },
	            legend: {
	                visible: false
	            }
			});		

			var oPopOver = this.getView().byId("idPopOver");
			oPopOver.connect(oVizFrame.getVizUid());
			oViewModel.setProperty("/busy", false);
		}
		
		
	});
});