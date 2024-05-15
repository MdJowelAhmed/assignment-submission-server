const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt=require('jsonwebtoken')
const cookieParser=require('cookie-parser')
const cors = require('cors');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

//  middleWere
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      // "https://cardoctor-bd.web.app",
      // "https://cardoctor-bd.firebaseapp.com",
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

const verifiedToken=async(req,res,next)=>{
  const token=req.cookies.token;
  console.log('value of token from middle were' ,token)
  if(!token){
    return res.status(401).send({message:'unauthorized access'})
  }
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    if(err=>{
      return res.status(401).send({message:'unauthorized access'})
    })
    console.log('from decoded',decoded)
    req.user=decoded
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

    await client.db("admin").command({ ping: 1 });

    // auth related 
    app.post('/jwt', (req,res)=>{
      const user=req.body
      console.log(user)
      const token=jwt.sign(user, process.env.ACCESS_TOKEN_SECRET , {expiresIn: '1h'})
      res
      .cookie('token',token,{
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
       
      })
      .send({succuss:true})
    })

    app.post('/logout',async(req,res)=>{
      const user=req.body
      res.clearCookie('token',{maxAge:0}).send({success:true})
    })


    app.get('/assignment', async (req, res) => {
      console.log('took  took', req.cookies.token)
      const cursor = assignmentsCollection.find()
      const result = await cursor.toArray()
      res.send(result)
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
    app.get('/assignments', async (req, res) => {
      const filter = req.query.filter
     
      let query = {}
     if(filter) query= {level:filter}
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
      // const query={
      //   email:submit.email,
      //   AssignmentId:submit.AssignmentId
      // }
     
      // const alreadySubmit=await submissionCollection.findOne(query)
      // return console.log(alreadySubmit)

      const result = await submissionCollection.insertOne(submit)
      res.send(result)
    })

    app.get('/submit/:email',verifiedToken, async (req, res) => {
      // const email=req.body
      // console.log({ submitEmail: req.params.email })
      console.log(req.user.email)
      if(req.params.email !== req.user.email){
        return res.status(403).send({message:'forbidden access'})
      }
      let params={}
      if(req.params?.email){
        params={"submit.submitEmail":req.params.email}
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
      const result = await submissionCollection.updateOne(query,updateDoc,options);
      res.send(result);
    })

    app.get('/pending', async (req, res) => {
      // const email=req.body
      console.log({ status: req.params.status })
      const result = await submissionCollection.find({ status: "pending" }).toArray()
      res.send(result)
    })


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