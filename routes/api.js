/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
var axios = require('axios');

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

module.exports = function (app, db) {

  app.route('/api/stock-prices')
    .get(function (req, res) {
      var { stock, like } = req.query;
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      const getStock = (stock, isLike, ip) => new Promise((res, rej) => {
        db.collection('stocks').findOne({ stock })
          .then(data => {
            if (data && isLike) {
              if (!data.likes.find(o => o == ip)) data.likes.push(ip);
              db.collection('stocks').updateOne({ stock }, data)
                .then(dat => { res({ stock: data.stock, price: data.price, likes: data.likes.length }) })
                .catch(error => rej(error))
            } else if (data && !isLike) {
              res({ stock: data.stock, price: data.price, likes: data.likes.length })
            } else {
              axios.get(`https://repeated-alpaca.glitch.me/v1/stock/${stock.toUpperCase()}/quote`)
                .then(data => {
                  const price = data.data.latestPrice;
                  db.collection('stocks').insertOne({ stock, price, likes: isLike ? [ip] : [] })
                    .then(data => res({ stock: data.ops[0].stock, price: data.ops[0].price, likes: data.ops[0].likes.length }))
                    .catch(error => rej(error))
                })
                .catch(error => rej(error));
            }
          })
          .catch(error => rej(error))
      })

      if (typeof stock === 'string') {
        getStock(stock, like, ip).then(data => res.json({ "stockData": data })).catch(error => res.json({ error }));
      } else if (typeof stock === 'object' && stock.length) {
        stock = stock.slice(0, 2);
        Promise.all(stock.map(o => getStock(o, like, ip))).then(data => {
          res.json({"stockData":[{"stock":data[0].stock,"price":data[0].price,"rel_likes":data[0].likes - data[1].likes},{"stock":data[1].stock,"price":data[1].price,"rel_likes":data[1].likes - data[0].likes}]})
        }).catch(error => res.json({ error }));
      } else {
        res.json({ error: 'Error' })
      }
    });

};
