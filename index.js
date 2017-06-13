const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

module.exports = (function(){
	function Model(name, schema, conn){
		this.conn = conn;
		this.model = this.conn.model(name, new mongoose.Schema(schema));
	}

	Model.prototype = {
		get: function(query, options, callback){
			let Model = this.model;
			let Query = null;

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
			return Query.exec(callback);
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

		set: function(query, data, callback){
			let Model = this.model;

			callback = callback || function(){};

			Model.find(query, (error, result) => {
				if (error) return callback(error, null);

				if (result && result.length > 0) {
					Model.update(query, {$set: data}, (updateErr) => {
						if (updateErr) return callback(updateErr, null);
						
						this.get({_id: result[0]._id}, callback);
					});
				} else {
					callback({message: 'not found'}, null);
				}
			});
		},

		setById: function(id, data, callback){
			let Model = this.model;

			callback = callback || function(){};

			Model.findByIdAndUpdate(id, {$set: data}, (error, result) => {
				if (error) return callback(error, null);
				
				this.get({_id: id}, callback);
			});
		},

		update: function(query, update, options, callback){
			let Model = this.model;

			options = options || {};
			callback = callback || function(){};
			if( typeof(options) == 'function' ){
				callback = options;
				options = {};
			}

			Model.find(query, (error, result) => {
				if (error) return callback(error, null);

				if (result && result.length > 0) {
					Model.update(query, update, options, (updateErr) => {
						if (updateErr) return callback(updateErr, null);
						
						this.get({_id: result[0]._id}, callback);
					});
				} else {
					callback({message: 'not found'}, null);
				}
			});
		},

		updateById: function(id, update, options, callback){
			let Model = this.model;

			options = options || {};
			callback = callback || function(){};
			if( typeof(options) == 'function' ){
				callback = options;
				options = {};
			}

			Model.findByIdAndUpdate(id, update, options, (error, result) => {
				if (error) return callback(error, null);
				
				this.get({_id: id}, callback);
			});
		},

		delete: function(query, callback){
			let Model = this.model;

			callback = callback || function(){};

			Model.find(query, (error, result) => {
				if (error) return callback(error, null);

				if (result && result.length > 0) {
					Model.remove(query, (deleteErr) => {
						if (deleteErr) return callback(deleteErr, null);
						callback(null, result);
					});
				} else {
					return callback({message: 'not found'}, null);
				}
			});
		},

		deleteById: function(id, callback){
			let Model = this.model;

			callback = callback || function(){};

			Model.findByIdAndRemove(id, (error, result) => {
				if (error) callback(error, null);
				callback(null, result);
			});
		},

		create: function(data, callback){
			let Model = this.model;

			callback = callback || function(){};

			Model.create(data, (error, result) => {
				if (error) return callback(error, null);
				callback(null, result);
			});
		}
	};

	function Connection(name, ...args){
		this.name = name;
		this.conn = mongoose.createConnection();
		this.connected = false;

		if( args.length > 0 ){
			this.open(...args);
		}
	}

	Connection.prototype = {
		open: function(...args){
			this.conn.open(...args);
			this.conn.once('connected', () => {
				this.connectUri = args[0];
				this.connected = true;
			});
		},

		close: function(callback){
			this.conn.close(() => {
				this.connected = false;
				callback && callback();
			});
		},

		setModels: function(models){
			for( let name in models ){
				this[name] = new Model(name, models[name], this.conn);
			}
		}
	};

	return {
		_connections: {},

		createConnection: function(name, ...args){
			if( this._connections[name] ){
				let connection = this._connections[name];
				if( connection.connected == true ){
					connection.close(function(){
						connection.connected = false;
						connection.open(...args);
					});
				} else {
					connection.open(...args);
				}
			} else {
				this._connections[name] = new Connection(name, ...args);
				this[name] = this._connections[name];
			}
		},

		closeConnection: function(name, callback){
			if( name && this._connections[name] ){
				let connection = this._connections[name];
				connection.close(function(){
					connection.connected = false;
					callback && callback();
				});
			}
		}
	};
})();