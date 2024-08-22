const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const cors = require('cors');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

//  middleWere
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://assignments-submission.web.app",
      "https://assignments-submission.firebaseapp.com/",
    ],
    credentials: true,
  })
);
app.use(express.json())
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ma7e2wv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifiedToken = async (req, res, next) => {
  const token = req.cookies.token;
  console.log('value of token from middle were', token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err => {
      return res.status(401).send({ message: 'unauthorized access' })
    })
      console.log('from decoded', decoded)
    req.user = decoded
    next()
  })

}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // Send a ping to confirm a successful connection

    const assignmentsCollection = client.db('assignmentsCreate').collection('assignments')
    const submissionCollection = client.db('assignmentsCreate').collection('submission')
    const studyCollection = client.db('assignmentsCreate').collection('material')
    const instructorsCollection = client.db('assignmentsCreate').collection('instructors')
    const reviewsCollection = client.db('assignmentsCreate').collection('review')

    // await client.db("admin").command({ ping: 1 });


    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    app.get('/assignment', async (req, res) => {
      const size = parseInt(req.query.size); // Number of items per page
      const page = parseInt(req.query.page) - 1; // Current page (0-based index)
      const order = req.query.order === 'desc' ? -1 : 1; // Determine sort order: 'desc' for descending, 'asc' for ascending

      console.log('Size:', size, 'Page:', page, 'Order:', order);

      try {
        const cursor = assignmentsCollection.find()
          .sort({ date: order }) // Sort by date field
          .skip(page * size)
          .limit(size);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).send({ error: 'Error fetching assignments' });
      }
    });


    // pagination
    app.get('/countAssignments', async (req, res) => {
      const count = await assignmentsCollection.countDocuments()
      res.send({ count })
    })

    app.post('/assignment', async (req, res) => {
      const assignment = req.body
      console.log(assignment)
      const result = await assignmentsCollection.insertOne(assignment)
      res.send(result)
    })
    app.get('/assignment/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await assignmentsCollection.findOne(query);
      res.send(result);
    })


    // assignment filter 
    app.get('/assignment', async (req, res) => {
      const filter = req.query.filter

      let query = {}
      if (filter) query = { level: filter }
      const result = await assignmentsCollection
        .find(query).toArray()
      res.send(result)
    })

    app.put('/assignment/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updateAssignment = req.body;

      const updated = {
        $set: {

          ...updateAssignment
        }
      }
      const result = await assignmentsCollection.updateOne(filter, updated, options)
      res.send(result)
    })

    app.delete('/assignment/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await assignmentsCollection.deleteOne(query)
      res.send(result)
    })


    // assignment submission
    app.get('/submission', async (req, res) => {
      const cursor = submissionCollection.find()
      const result = await cursor.toArray()
      res.send(result)
    })

    app.post('/submission', async (req, res) => {
      const submit = req.body
      const result = await submissionCollection.insertOne(submit)
      res.send(result)
    })

    app.get('/submit/:email', verifiedToken, async (req, res) => {
      console.log(req.user.email)
      if (req.params.email !== req.user.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      let params = {}
      if (req.params?.email) {
        params = { "submit.submitEmail": req.params.email }
      }
      const result = await submissionCollection.find(params).toArray()
      res.send(result)
    })

    app.get('/submitted/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await submissionCollection.findOne(query);
      res.send(result);
    })
    // update 
    app.patch('/submitted/:id', async (req, res) => {
      const id = req.params.id;
      const status = req.body
      const query = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const updateDoc = {
        $set: status,
      }
      const result = await submissionCollection.updateOne(query, updateDoc, options);
      res.send(result);
    })

    app.get('/pending', async (req, res) => {
      // const email=req.body
      console.log({ status: req.params.status })
      const result = await submissionCollection.find({ status: "pending" }).toArray()
      res.send(result)
    })

    // study material 

    app.get('/study', async (req, res) => {
      const cursor = studyCollection.find()
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/instructors', async (req, res) => {
      const cursor = instructorsCollection.find()
      const result = await cursor.toArray()
      res.send(result)
    })

    // GET API to retrieve reviews
    app.get('/reviews', async (req, res) => {
      const reviews = await reviewsCollection.find().toArray();
      res.send(reviews)
    });


    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('ASSIGNMENTS SUBMISSION SERVER IS RUNNING')
})
app.listen(port, () => {
  console.log(`ASSIGNMENTS SUBMISSION ON port: ${port}`)
})