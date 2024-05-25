const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 9000;

const app = express();

// middleware
const corsOptions = {
  origin: [
    "http://localhost:5173",
    // "https://tastematrix.web.app",
    // "https://tastematrix.firebaseapp.com",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

//tasteMatrix
//jflpgQ2l5tTekptw

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.epjsucj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const cookieOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  secure: process.env.NODE_ENV === "production" ? true : false,
};
//localhost:5000 and localhost:5173 are treated as same site.  so sameSite value must be strict in development server.  in production sameSite will be none
// in development server secure will false .  in production secure will be true

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const foodsCollection = client.db("tasteMatrix").collection("foods");
    const jobsCollection = client.db("tasteMatrix").collection("jobs");



    //add food items
    app.post("/foods", async (req, res) => {
      const foodItem = req.body;
      const result = await foodsCollection.insertOne(foodItem);
      res.send(result);
    });


    //get all food items posted by a specipic user base on email
    app.get("/my-added-item/:email", async (req, res) => {
      const email = req.params.email;
      const query = {'addedBy.userEmail': email}
      const result = await foodsCollection.find(query).toArray();
      res.send(result);
    });

    // //get all jobs posted by a specipic user
    // app.get("/jobs/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const query = { "buyer.email": email };
    //   const result = await jobsCollection.find(query).toArray();
    //   res.send(result);
    // });




    //Get all jobs data from db
    app.get("/foods", async (req, res) => {
      const result = await foodsCollection.find().toArray();
      res.send(result);
    });

    //get a single job data from db using job id
    app.get("/food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodsCollection.findOne(query);
      res.send(result);
    });

    //Get all jobs data from db for pagination
    app.get("/all-foods", async (req, res) => {
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) - 1;
      const filter = req.query.filter;
      const sort = req.query.sort;
      const search = req.query.search;
      console.log(page, size);

      let query = {
        food_name: { $regex: search, $options: "i" },
      };

      // if (filter) query = { food_category: filter };
      if (filter) query.food_category = filter;

      let options = {};
      if (sort) options = { sort: { price: sort === "asc" ? 1 : -1 } };

      const result = await foodsCollection
        .find(query, options)
        .skip(page * size)
        .limit(size)
        .toArray();

      res.send(result);
    });

    //Get all jobs data count from db
    app.get("/foods-count", async (req, res) => {
      const filter = req.query.filter;
      const search = req.query.search;
      let query = {
        food_name: { $regex: search, $options: "i" },
      };

      // if (filter) query = { food_category: filter };
      if (filter) query.food_category = filter;

      const count = await foodsCollection.countDocuments(query);

      res.send({ count });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("Hello form solosphare server by assignment 11..........");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
