const { MongoClient, GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://Joy:andr@2006@stackysparks.mn9tyeo.mongodb.net/EduViz';
let db, gfs;

MongoClient.connect(mongoURI)
  .then((client) => {
    console.log('Connected to MongoDB');
    db = client.db('3d_models_db');
    gfs = new GridFSBucket(db, { bucketName: 'models' });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Connect Mongoose
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Mongoose connected'))
  .catch((error) => console.error('Mongoose connection error:', error));

module.exports = { getDb: () => db, getGfs: () => gfs, mongoose };
