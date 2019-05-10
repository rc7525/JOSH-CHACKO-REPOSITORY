var mongoose = require("mongoose");

var proseSchema = new mongoose.Schema({
    name: String,
    image: String,
    body: String, 
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        email: String,
        firstName: String,
        lastName: String
    },
    reviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Review"
        }
    ],
    rating: {
        type: Number,
        default: 0
    }
}, {
    // if timestamps are set to true, mongoose assigns createdAt and updatedAt fields to your schema, the type assigned is Date.
    timestamps: true
});    


//To export the model
module.exports = mongoose.model("Prose", proseSchema);