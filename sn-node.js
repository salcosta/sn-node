var parseString = require('xml2js').parseString;
var _ = require('underscore');
var fs = require('fs');
var async = require('async');

var HEADERS = {
	"Connection": "keep-alive",
	"Cache-Control" : "max-age=0",
	"Accept" : "*/*",
	"User-Agent": "ServiceNow Node Client",
	"Content-Type": "application/x-www-form-urlencoded",
	"Accept-Language": "en-US,en;q=0.8"
};

var READY = 0,
	LOGGED_OUT = -1,
	LOGGING_IN = -0,
	INVALID_CREDENTIALS = -2;

function ServiceNow(instance, user, pass){
	var self = this;
	self.request = require("request");

	self.instance = "https://" + instance + '.service-now.com/';
	self.user = user;
	self.pass = pass;
	self.status = LOGGED_OUT;

	self.request_queue = async.queue( function(task, callback){
		console.log("Making Request to: " + task.data.options.uri )
		self.executeRequest(task.data, callback);
	}, 1 );

	self.token = "";

	self.auth =  { 
		"user" : user,
		"pass" : pass,
		"sendImmediately" : true
	};

	self.req_options = {
		followAllRedirects : true,
		headers : HEADERS,
		jar : true
	};

	self.login = function(){
		var data =  { 
						"user_name" : self.user,
						"user_password" : self.pass,
						"ni.nolog.user_password" :"true",
						"ni.noecho.user_name": "true",
						"ni.noecho.user_password" : "true",
						"remember_me" : "true",
						"screensize":"1920x1080",
						"sys_action" : "sysverb_login",
						"not_important" : ""
					};

		self.add_request({
			fn : self.request.post,
			cb : function(){},
			file : "",
			options : self.get_options({ "uri" : self.instance + "login.do", "form" : data })
		});


	};

	self.get_options = function( custom_options ){
		var new_options = {};

		for( var i in self.req_options ){
			new_options[i] = self.req_options[i];
		}

		for( i in custom_options ){
			new_options[i] = custom_options[i];
		}

		return new_options
	}

	self.set_token = function( result ){
		var ck = result.split("var g_ck = '")[1].split('\'')[0];

		if( ck !== ""){
			self.token  = ck;
			self.req_options.headers['X-UserToken'] = self.token;
		} else {
			self.status = INVALID_CREDENTIALS;
		}
	};

	self.add_request = function(request){
		self.request_queue.push({ name: 'request', data : request }, function(err){
			if(err) console.log("An error occured " + err);
		});
	};

	self.get = function( ){
		var path = "",
			cb = "",
			file = "";

		if( arguments.length == 2 ){
			path = arguments[0];
			cb = arguments[1];
		} else if( arguments.length == 3){
			path = arguments[0];
			file = arguments[1];
			cb = arguments[2];
		}

		self.add_request({
			fn : self.request.get,
			cb : cb,
			file : file,
			options : self.get_options({ "uri" : self.instance + path })
		});

	};

	self.post = function(){
		var path = "",
			data = "",
			cb = "",
			file = "";

		if( arguments.length == 3 ){
			path = arguments[0];
			data = arguments[1];
			cb = arguments[2];
		} else if( arguments.length == 4){
			path = arguments[0];
			data = arguments[1];
			file = arguments[2];
			cb = arguments[3];
		}

		self.add_request({
			fn : self.request.post,
			cb : cb,
			file : file,
			options : self.get_options({ "uri" : self.instance + path, "form" : data })
		});

		
	};

	self.executeRequest = function( request, callback ){
		if( self.status == INVALID_CREDENTIALS ){
			console.log("Cannot Make request")
			callback();
		} else if( request.file !== "" ){
			var r = request.fn(request.options).pipe(fs.createWriteStream(request.file));
			r.on('close', function(){
				request.cb();
				callback();
			});

		} else {
			request.fn( request.options , function(error, response, body){
				self.status = self.check_state(body);
				request.cb(body);
				callback();
			});		
		}


	};

	self.check_state = function( body ){

		if( self.token === "" ) self.set_token( body );

		if( body.indexOf("Establishing session") != -1 ) return LOGGING_IN
		if( body.indexOf("User name or password invalid") != -1 ) return INVALID_CREDENTIALS
		return READY
	}

	self.GlideAJAX = function( processor ){

		this.initialize = function(processor) {
			this.data = {};
			this.addParam("sysparm_processor", processor);			
		};

		this.getProcessor = function() {
			return this.processor;
		};

		this.makeRequest = function(cb) {
			self.post( "xmlhttp.do" , this.data, function(response){
					parseString(response, function (err, result) {
						cb(result.xml.$.answer);
					});

			});			
			
		};

		this.addParam = function( parameter, value){
			this.data[parameter] = value;
		};

		this.initialize(processor);

	};

	self.GlideRecord = function( tableName ){
		this.initialized = false;

		this.initialize = function(tableName) {
			var xname;
			this.currentRow = -1;
			this.rows = [];
			this.conditions = [];
			this.encodedQuery = "";
			this.orderByFields = [];
			this.displayFields = [];
			
			if (tableName)
				this.setTableName(tableName);
			
			if (this.initialized === false) {
				this.ignoreNames = [];
			
				for( xname in this ) {
					this.ignoreNames[xname] = true;
				}

			} else {
				for( xname in this ) {
					if (this.ignoreNames[xname] && this.ignoreNames[xname] === true)
						continue;
						
					delete this[xname];
				}
			}
			
			this.initialized = true;
		};

		this.addQuery =  function() {
			var fName;
			var fOper;
			var fValue;
		
			if (arguments.length == 2) {
				fName = arguments[0];
				fOper = '=';
				fValue = arguments[1];
			} else if (arguments.length == 3) {
				fName = arguments[0];
				fOper = arguments[1];
				fValue = arguments[2];
			}
		
			this.conditions.push({ 'name' : fName, 'oper' : fOper, 'value' : fValue});
		};


		this.getEncodedQuery = function() {
			var ec = this.encodedQuery;
			
			for(var i = 0; i < this.conditions.length; i++) {
				var q = this.conditions[i];
				ec += "^" + q.name + q.oper + q.value;
			}
			
			return ec;
		};


		this.deleteRecord = function() {
			var me = this;
			var data = {
				"sysparm_processor" : "AJAXGlideRecord",
				"sysparm_name" : this.getTableName(),
				"sysparm_type" : "delete",
				"sysparm_chars" : this._getXMLSerialized()
			};
			
			self.post( "xmlhttp.do" , data, function(response){
					parseString(response, function (err, result) {
						cb(result.xml.item[0]);
					});

			});				

		};
		
		this.get = function(id, cb) {
			var me = this;

			this.initialize();
			this.addQuery('sys_id', id);
			this.query( function(result){
				me.next();
				cb(result);
			});
			
		};
		
		this.getTableName = function() {
			return this.tableName;
		};

		this.hasNext = function() {
			return (this.currentRow + 1 < this.rows.length);
		};
		
		this.insert = function(cb) {
			return this.update(cb);
		};
		
		this.gotoTop = function() {
			this.currentRow = -1;
		};
	
		this.next = function() {
			if (!this.hasNext())
				return false;
		
			this.currentRow++;
			this.loadRow(this.rows[this.currentRow]);
			return true;
		};
		
		this.gotoID = function(id){
			this.currentRow = -1;	

			if (!this.hasNext())
				return false;

			while(this.next()){
				if(this.sys_id == id){
					return true;
				}
			}

			return false;
		};

		this.loadRow = function(r) {
			for (var i = 0; i < r.length; i++)  {
				var name = r[i].name;
				var value = r[i].value;

				if (this.isDotWalkField(name)) {
					var start = this;
					var parts = name.split(/-/);
					
					for(var p = 0; p < parts.length - 1; p++) {
						var part = parts[p];
						
						if (typeof start[part] != 'object')
							start[part] = {};
						
						start = start[part];
					}
					
					var fieldName = parts[parts.length - 1];
					start[fieldName] = value;
				} else {
					this[name] = value;
				}
			}
		};

		this.isDotWalkField = function(name) {
			for(var i = 0; i < this.displayFields.length; i++) {
				var fieldName = this.displayFields[i];
				if (fieldName.indexOf(".") == -1)
					continue;
				
				var encodedFieldName = fieldName.replace(/\./g,"-");
				if (name == encodedFieldName)
					return true;
			}
			
			return false;
		};
		
		this.addOrderBy = function(f) {
			this.orderByFields.push(f);
		};
		
		this.orderBy = function(f) {
			this.orderByFields.push(f);
		};
		
		this.setDisplayFields = function(fields) {
			this.displayFields = fields;
		};
	
		this.query = function( cb ) {
			var me = this;
			var data = {
				"sysparm_processor" : "AJAXGlideRecord",
				"sysparm_name" : this.getTableName(),
				"sysparm_type" : "query",
				"sysparm_chars" : this.getEncodedQuery()
			};
			
			self.post( "xmlhttp.do" , data, function(response){
					parseString(response, function (err, result) {
						var rows = [];
						
						result.xml.item.map(function(item){
							var newRec = [];
							delete item.$;
							for(var v in item){
								newRec.push({ "name" : v, "value" : item[v][0] });
							}

							rows.push(newRec);
						});

						me.setRows(rows);
						cb(me);
					});

			});			
			
		};

		this.setRows = function(r) {
			this.rows = r;
		};
		
		this.setTableName = function(tableName) {
			this.tableName = tableName;
		};

		this.update = function(cb) {
			var me = this;
			var data = {
				"sysparm_processor" : "AJAXGlideRecord",
				"sysparm_name" : this.getTableName(),
				"sysparm_type" : "save_list",
				"sysparm_chars" : this._getXMLSerialized()
			};
			
			self.post( "xmlhttp.do" , data, function(response){
					parseString(response, function (err, result) {
						if( result.xml.hasOwnProperty('item') ){
							cb(result.xml.item[0]._);
						} else {
							cb(result.xml.$);
						}
						
					});

			});	


		};
	
		this.getXMLSerialized = function() {
			return this._getXMLSerialized();
		};

		this._getXMLSerialized = function() {
			
			var updateString = '<record_update id="id_goes_here" table="' + this.getTableName() + '">';

			updateString+="<" + this.getTableName() + ">";


			for(var xname in this) {
				if (this.ignoreNames[xname])
					continue;
			
				var v = this[xname];
				
				if (!v)
					v = "NULL";

				updateString+="<" + xname + ">" + v + "</" + xname + ">";				

			}

			updateString+="</" + this.getTableName() + ">";
			updateString+="</record_update>";

			return updateString;
		};
	
		this.z = null;
		this.initialize(tableName);

	};

}

module.exports = ServiceNow;