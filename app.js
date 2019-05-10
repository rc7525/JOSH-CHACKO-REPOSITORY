
//To include all the contents of express to the aplication
var express                 = require("express"),
    app                     = express(),
    bodyParser              = require("body-parser"),
    mongoose                = require("mongoose"),
    flash                   = require("connect-flash"),
    passport                = require("passport"),
    LocalStrategy           = require("passport-local"),
    User                    = require("./models/user"),
    methodOverride          = require("method-override")
    
var poemRoutes              = require("./routes/poems"),
    proseRoutes             = require("./routes/proses"),
    indexRoutes             = require("./routes/index"),
    reviewRoutes            = require("./routes/reviews")
    
require('dotenv').config();

mongoose.connect(process.env.DATABASEURL, {useNewUrlParser: true, useCreateIndex: true});
//Local Database
//mongoose.connect("mongodb://localhost/josh_chacko", {useNewUrlParser: true, useCreateIndex: true});
//Database connection for MongoDB Atlas for deploying application to Heroku
//mongoose.connect("mongodb+srv://admin:admin@cluster0-irwn6.mongodb.net/josh_chacko?retryWrites=true", {useNewUrlParser: true, useCreateIndex: true});

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname  + "/public"));
app.set("view engine", "ejs");

//flash
app.use(flash());

//Method Override
app.use(methodOverride("_method"));

//PASSPORT CONFIGURATION for password reset. 
app.use(require("express-session")({
    //This secret is use to unencode  
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
//for creating the session, taking the data and unencoding it
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//FOR NOTIFICATION
app.use(async function(req, res, next){
  res.locals.currentUser = req.user;
  if(req.user) {
    try {
      let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec();
      res.locals.notifications = user.notifications.reverse();
    } catch(err) {
      console.log(err.message);
    }
  }
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

//Using the routes defined in the routes directory
app.use(indexRoutes);
app.use(poemRoutes);
app.use(proseRoutes);
app.use(reviewRoutes);

//gives the port that cloud9 assigns and also an IP that cloud9 expects.
app.listen(process.env.PORT, process.env.IP, function(){
    console.log("The Josh Chacko Server has started!!!");
});
