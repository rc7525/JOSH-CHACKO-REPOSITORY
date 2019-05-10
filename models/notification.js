var mongoose             = require("mongoose");

var notificationSchema = new mongoose.Schema({
    email: String,
    poemId: String,
    poemName: String,
    proseId: String,
    proseName: String,
    isRead: {type: Boolean, default:false}
});    

//To export the model
module.exports = mongoose.model("Notification", notificationSchema);