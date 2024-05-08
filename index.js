require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

// app.get("/", (req, res) => {
//     res.send('Hello world!')
// })
const client = new MongoClient(process.env.MONGO_URL, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const database = client.db("Tesiting-eshikhon-final-project");
    const usersCollection = database.collection("Users");
    const productsCollection = database.collection("Products");
    const categoriesCollection = database.collection("Categories");
    const ordersCollection = database.collection("Orders");
    app.get("/", async (req, res) => {
      res.send("Variety Store Server is Running.");
    });
    // Users Route
    app.post("/users", async (req, res) => {
      const user = req.body;
      const isExistEmail = await usersCollection.findOne({ email: user.email });
      if (isExistEmail) {
        return res.send({ error: "User already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.get("/users", async (req, res) => {
      const query = {};
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    app.put("/users/admin/:id", async (req, res) => {
      const frontId = req.params.id;
      const reqBody = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(frontId) },
        {
          $set: {
            role: reqBody.role,
          },
        },
        { upsert: true }
      );
      res.send(result);
    });
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const searchDeleteId = { _id: new ObjectId(id) };
      const deletedUser = await usersCollection.deleteOne(searchDeleteId);
      res.send(deletedUser);
    });
    // Chack user Role
    app.get("/chack-role", async (req, res) => {
      const email = req.query.email;
      const result = await usersCollection.findOne({ email: email });
      res.send(result);
    });

    // GET All buyers
    app.get("/buyers", async (req, res) => {
      const result = await usersCollection.find({ role: "buyer" }).toArray();
      res.send(result);
    });
    // GET All Admin
    app.get("/admins", async (req, res) => {
      const result = await usersCollection.find({ role: "admin" }).toArray();
      res.send(result);
    });

    // Category Route
    app.post("/category", async (req, res) => {
      const reqBody = req.body;
      const result = await categoriesCollection.insertOne(reqBody);
      res.send(result);
    });
    app.get("/category", async (req, res) => {
      const result = await categoriesCollection.find({}).toArray();
      res.send(result);
    });
    // Products get by category
    app.get("/category/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection
        .find({ categoryId: id })
        .toArray();
      res.send(result);
    });
    // Products Route
    app.get("/products", async (req, res) => {
      const query = {};
      const result = await productsCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });
    app.get("/single-product/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.findOne({
        _id: new ObjectId(id),
      });
      const relatedProducts = await productsCollection
        .find({ categoryId: result.categoryId })
        .toArray();
      res.send({ product: result, relatedProducts });
    });

    app.get("/my-products", async (req, res) => {
      const email = req.query.email;
      const userEmail = await usersCollection.findOne({ email: email });
      if (userEmail.role === "admin") {
        const result = await productsCollection
          .find({})
          .sort({ _id: -1 })
          .toArray();
        res.send(result);
      } else {
        const result = await productsCollection
          .find({ email: email })
          .sort({ _id: -1 })
          .toArray();
        res.send(result);
      }
    });

    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const searchDeleteId = { _id: new ObjectId(id) };
      const deletedUser = await productsCollection.deleteOne(searchDeleteId);
      res.send(deletedUser);
    });

    app.post("/products", async (req, res) => {
      const email = req.query.email;
      const reqBody = req.body;
      const existUser = await usersCollection.findOne({ email: email });
      const result = await productsCollection.insertOne({
        ...reqBody,
        seller: existUser.name,
        verify: existUser.verify,
        email: existUser.email,
      });
      res.send(result);
    });

    // Update products
    app.put("/products/:id", async (req, res) => {
      const id = req.params.id;
      const reqBody = req.body;
      const result = await productsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: reqBody }
      );
      res.send(result);
    });

    // Orders Router
    app.post("/orders", async (req, res) => {
      const reqBody = req.body;
      const result = await ordersCollection.insertOne(reqBody);
      res.send(result);
    });
    app.get("/orders", async (req, res) => {
      const email = req.query.email;
      const result = await ordersCollection
        .find({ buyerEmail: email })
        .toArray();
      res.send(result);
    });
    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const result = await ordersCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // sellers Route
    app.get("/sellers", async (req, res) => {
      const result = await usersCollection.find({ role: "seller" }).toArray();
      res.send(result);
    });
    // Seller verify Route
    app.get("/seller-verify", async (req, res) => {
      const email = req.query.email;
      var verify = /^true$/i.test(req.query.verify);
      const result = await usersCollection.updateOne(
        { email: email },
        { $set: { verify: verify } }
      );
      if (result.acknowledged) {
        const result = await usersCollection.findOne({ email: email });
        res.send({ verify: result.verify });
      }
    });

    // Payment Gateway
    // checkout api
    app.post("/api/create-checkout-session", async (req, res) => {
      const products = req.body;
      // const lineItems = products.map((product) => ({
      //   price_data: {
      //     currency: "inr",
      //     product_data: {
      //       name: product.dish,
      //       images: [product.imgdata],
      //     },
      //     unit_amount: product.price * 100,
      //   },
      //   quantity: product.qnty,
      // }));
      const lineItems = [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: products.name,
              images: [products.image],
            },
            unit_amount: products.price * 100,
          },
          quantity: products.quantity,
        },
      ];
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${process.env.CLIENT_URL}/sucess`,
        cancel_url: `${process.env.CLIENT_URL}/cancel`,
      });
      res.send(session);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Our server run on: ${port} port`);
});
