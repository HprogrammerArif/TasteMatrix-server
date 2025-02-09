const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
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
app.use(cookieParser());

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

//middlewares
const logger = async (req, res, next) => {
  console.log("called", req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  //console.log("value of token in middleware", token);
  if (!token) {
    return res.status(401).send({ message: "Not Authorized" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    //errror
    if (err) {
      return res.status(401).send({ message: "unauthorized" });
    }
    //if token is valid then it would be decoded
    // console.log("value in the token", decoded);
    req.user = decoded;
    next();
  });
};

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
    const purchaseCollection = client.db("tasteMatrix").collection("purchases");

    //auth releted api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("loggin out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // save a purchase data in db
    app.post("/purchase", async (req, res) => {
      const purchaseData = req.body;
      console.log(purchaseData);
      const result = await purchaseCollection.insertOne(purchaseData);

      //update purchase count in foods collection
      const updateDoc = {
        $inc: { purchase_count: 1 },
      };
      const foodQuery = { _id: new ObjectId(purchaseData.id) };
      const updatePuchaseCount = await foodsCollection.updateOne(
        foodQuery,
        updateDoc
      );
      res.send(result);
    });

    // get all purchase order for a user by email from db
    app.get("/my-order/:email", logger, verifyToken, async (req, res) => {
      console.log("token owneer info", req.user);

      if (req.params.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const userEmail = req.params.email;
      console.log("usr email", userEmail);
      const query = { userEmail };
      const result = await purchaseCollection.find(query).toArray();
      res.send(result);
    });

    //delete a order data from db
    app.delete("/delete-item/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await purchaseCollection.deleteOne(query);
      res.send(result);
    });

    //add food items
    app.post("/foods", async (req, res) => {
      const foodItem = req.body;
      const result = await foodsCollection.insertOne(foodItem);
      res.send(result);
    });

    //get all food items posted by a specipic user base on email
    app.get("/my-added-item/:email", logger, verifyToken, async (req, res) => {
      if (req.params.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const email = req.params.email;
      const query = { "addedBy.userEmail": email };
      const result = await foodsCollection.find(query).toArray();
      res.send(result);
    });

    // update a food item in db
    app.put("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const foodData = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...foodData,
        },
      };
      const result = await foodsCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    
    //Get all jobs data from db
    app.get("/foods", async (req, res) => {
      try {
        const options = { sort: { purchase_count: -1 } }; // Use -1 for descending order
    
        const result = await foodsCollection.find({}, options).limit(6).toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
      }
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
