# sn-node -- ServiceNow Node Client with GlideAPI

[![NPM](https://nodei.co/npm/sn-node.png)](https://nodei.co/npm/sn-node/)

sn-node is a ServiceNow client that extends the GlideAPI to Node as well as providing standard HTTP GET and POST functions

## Logging In

To log in simply include sn-node and create an instance to your...err...instance.  An instance of your instance.
It is not necessary to put the whole instance name, just the prefix will work.  
For example if you go to https://sniscool.service-now.com, then your instance name is 'sniscool'

```javascript
var ServiceNow = require("sn-node");
var my_instance = new ServiceNow("instance name", "user name" ,"password");
my_instance.login();
```

## Basic Request

Once logged in you can now make requests to pages.  Here is a simple request to get home.do

```javascript
instance.get( 'home.do', function(result){
 	console.log(result);
});
```

You can also do a post to submit forms.

```javascript
instance.post( 'some_form.do', { 'field' : 'value' }, function(result){
 	console.log(result);
});
```

You may also download files by specifying a file name for either get or post.

```javascript
instance.get( 'home.do','downloaded_home.html', function(result){
 	console.log(result);
});

instance.post( 'some_form.do', { 'field' : 'value' }, "result.html", function(result){
 	console.log(result);
});
```

## GlideRecord

The GlideRecord object has been fully replicated and even extended in sn-node.  You can use the functions as you normally would however since node executes differently than the browser or the ServiceNow server you must specify call backs for requests.  This will only affect query, update, insert, delete, get.

This is a simple GlideRecord request.  Notice to create a new instance of GlideRecord you must use the instance object.

```javascript
var newRec = new instance.GlideRecord("incident");
newRec.addQuery("priority","1");
newRec.query( function(records){
	console.log(records.rows.length)
});
```

The callback function passed to query will receive the same object back as a parameter so you can use it just like you would normally except it will just be in the callback.

```javascript
var newRec = new instance.GlideRecord("incident");
newRec.addQuery("priority","1");
newRec.query( function(records){
	while( records.next() ){
		console.log( records.short_description );
	}
});
```

You may also do inserts as you normally would.  The callback function for insert will receive the new sys_id of the created record.

```javascript
var newRec = new instance.GlideRecord("incident");
newRec.priority = "1";
newRec.short_description = "New incident from SN Client Node";
newRec.insert(function(id){
	console.log(id)
});
```

The get function accepts two parameters, the first is the sys_id as usual, the second is the callback, which will receive the current GlideRecord object back, which can then be used like normal.

```javascript
var newRec = new instance.GlideRecord("incident");
newRec.get('5a59c74a1c4bd5007cf2ca8156e70781', function(gr){
	console.log(gr.short_description)
});
```

Updates will also work.  Here is a more complex example, in order for the code to execute in the correct order, the subsequent actions are nested within the callbacks.  This example makes two calls, the first to get the record and one more to update it.

```javascript
var newRec = new instance.GlideRecord("incident");
newRec.get('0f5934ed1c87d5007cf2ca8156e707d9',function(result){
	result.short_description = "It be updated2";
	result.update(function(result){ 
		console.log(result) 
	});
});
```

Here is another example updating an entire GlideRecord object.

```javascript
var newRec = new instance.GlideRecord("incident");
newRec.addQuery("priority","1");
newRec.query( function(records){
	var count = 0;
	while( records.next() ){
		records.short_description = records.short_description + " " + count;
		count++;
		records.update(function(){ });
	}
});
```

Finally, I have also added a gotoID function to quickly go to a record with a specific ID.  This could be useful if you keep a list in cache and need to use it to look up referenced fields as dotwalking will not work. 

This example just queries for all incidents and then goes directly to the record with the given ID.

```javascript
var newRec = new instance.GlideRecord("incident");

newRec.query(function(results){
	results.gotoID('5ed049682ba541007cf27f30f8da157c');
	console.log(results.short_description)
});
```

## GlideAJAX

GlideAJAX has been replicated although the functions to do a synchronous call have been removed since they do not fit into node.

Here is a simple example of a simple AJAX call to a Script Include.  Note: Script Includes will need to be set to Client Callable as the request is executed as a client.

```javascript
var ga = new instance.GlideAJAX("RemoteTest");
ga.addParam("sysparm_name", "helloWorld");
ga.makeRequest(function(result){
					console.log(result);
				});
```

Notice now to make the request it is simply makeRequest and the function always takes a callback.


## Notes on structure

In order to simplify requests sn-node uses a queue for transactions. This means a single request can be made per instance object.  When new requests are made they are actually added to the queue and are executed in order received.

So for claritys sake here is a snippet with annotations showing what order the requests will be made

```javascript
var ServiceNow = require("./sn-node.js");
var instance = new ServiceNow("myinstance", "admin" ,"password");
// 1 - request to login
instance.login();

// 2 - request to home.do
instance.get( 'home.do', 'home.html', function(result){
 	console.log(result);
});

var newRec = new instance.GlideRecord("incident");
// 3 - GlideRecord to incident table
newRec.get('0f5934ed1c87d5007cf2ca8156e707d9',function(result){
	result.short_description = "It be updated2";
	// 5 - GlideRecord to update
	result.update(function(result){ 
		console.log(result) 
	});
});

var anotherRec = new instance.GlideRecord("incident");
// 4 - GlideRecord to get incident record
anotherRec.get('5a59c74a1c4bd5007cf2ca8156e70781', function(gr){
	console.log(gr.short_description)
});
```

## Callbacks

The use of callbacks is not common within ServiceNow and will take some getting used to.  The callback function will be executed whenever the calling function is complete.  Node does not wait around and moves on to the next line.  You can never be certain which will actually be finished first and because of this, if you are dependent on a call being finished you must put the dependent code in a callback.


## Feedback

You are free to use this library in any project you want persuant to the license.  I welcome any feedback or suggestions for enhancements.  To log an issue please use the Issues feature in Github.

My current plans for the library to include better error handling and continue adding functionality.
