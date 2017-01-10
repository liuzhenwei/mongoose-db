const objectAssign = require('object-assign');
const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

module.exports = (function(){
	function Model(name, schema, conn){
		this.conn = conn;
		this.model = this.conn.model(name, new mongoose.Schema(schema));
	}

	Model.prototype = objectAssign(Model.prototype, {
		get: function(query, options, callback){
			var Model = this.model;
			var Query = null;

			if( typeof(query) == 'function' ){
				callback = query;
				query = {};
			} else {
				query = query || {};
				options = options || {};
				callback = callback || function(){};
				if( typeof(options) == 'function' ){
					callback = options;
					options = {};
				}

				if( options.pageSize ){
					if( options.lastId ){
						query['_id'] = {'$gt': ObjectId(options.lastId)};
						Query = Model.find(query).limit(options.pageSize);
					} else {
						options.page = options.page || 1;
						Query = Model.find(query).skip(options.pageSize * (options.page - 1)).limit(options.pageSize);
					}
					options.sort = options.sort || -1;
				}
				if( options.sort ){
					Query = Query || Model.find(query);
					Query.sort({'_id': options.sort});
				}
			}

			Query = Query || Model.find(query);
			Query.exec(callback);
		},

		getById: function(id, callback){
			return this.get({_id: id}, callback);
		},

		getAll: function(options, callback){
			callback = callback || function(){};
			if( typeof(options) == 'function' ){
				callback = options;
				options = {};
			}
			return this.get({}, options, callback);
		},

		update: function(query, data, callback){
			var Model = this.model;

			callback = callback || function(){};

			Model.find(query, (error, result) => {
				if (error) return callback(error, null);

				if (result && result.length > 0) {
					Model.update(query, {$set: data}, updateErr => {
						if (updateErr) return callback(updateErr, null);
						result.forEach(function(item, i){
							item = objectAssign(item, data);
						});
						callback(null, result);
					});
				} else {
					return callback({message: 'not found'}, null);
				}
			});
		},

		updateById: function(id, data, callback){
			var Model = this.model;

			callback = callback || function(){};

			Model.findByIdAndUpdate(id, {$set: data}, (error, result) => {
				if (error) return callback(error, null);
				callback(null, objectAssign(result, data));
			});
		},

		delete: function(query, callback){
			var Model = this.model;

			callback = callback || function(){};

			Model.find(query, (error, result) => {
				if (error) return callback(error, null);

				if (result && result.length > 0) {
					Model.remove(query, deleteErr => {
						if (deleteErr) return callback(deleteErr, null);
						callback(null, result);
					});
				} else {
					return callback({message: 'not found'}, null);
				}
			});
		},

		deleteById: function(id, callback){
			var Model = this.model;

			callback = callback || function(){};

			Model.findByIdAndRemove(id, (error, result) => {
				if (error) callback(error, null);
				callback(null, result);
			});
		},

		create: function(data, callback){
			var Model = this.model;

			callback = callback || function(){};

			Model.create(data, (error, result) => {
				if (error) return callback(error, null);
				callback(null, result);
			});
		}
	});

	function Connection(name, openArgs){
		this.name = name;
		this.conn = mongoose.createConnection();
		this.connected = false;

		if( openArgs.length > 0 ){
			this.open.apply(this, openArgs);
		}
	}

	Connection.prototype = objectAssign(Connection.prototype, {
		open: function(){
			var args = Array.prototype.slice.call(arguments);
			this.conn.open.apply(this.conn, args);
			this.conn.once('connected', function(){
				this.connectUri = args[0];
				this.connected = true;
			}.bind(this));
		},

		close: function(callback){
			this.conn.close(function(){
				this.connected = false;
				callback && callback();
			}.bind(this));
		},

		setModels: function(models){
			for( var name in models ){
				this[name] = new Model(name, models[name], this.conn);
			}
		}
	});

	return {
		_connections: {},

		createConnection: function(name){
			var args = Array.prototype.slice.call(arguments, 1);
			if( this._connections[name] ){
				var connection = this._connections[name];
				if( connection.connected == true ){
					connection.close(function(){
						connection.connected = false;
						connection.open.apply(connection, args);
					});
				} else {
					connection.open.apply(connection, args);
				}
			} else {
				this._connections[name] = new Connection(name, args);
				this[name] = this._connections[name];
			}
		},

		closeConnection: function(name, callback){
			if( name && this._connections[name] ){
				var connection = this._connections[name];
				connection.close(function(){
					connection.connected = false;
					callback && callback();
				});
			}
		}
	};
})();