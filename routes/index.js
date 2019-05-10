var express     = require("express");
var router      = express.Router();
var passport    = require("passport");
var validator   = require("express-validator/check");
var User        = require("../models/user");
var Poem        = require("../models/poem");
var Prose       = require("../models/prose");
var async       = require("async");
var nodemailer  = require("nodemailer");
var crypto      = require("crypto");
var middleware  = require("../middleware");
var multer = require('multer');
var methodOverride = require("method-override");
var Notification  = require("../models/notification");

require('dotenv').config();

//Method Override
router.use(methodOverride("_method"));

//MULTER
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});

var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

var upload = multer({ storage: storage, fileFilter: imageFilter});

//CLOUDINARY
var cloudinary = require('cloudinary');
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME, 
  //api_key: process.env.CLOUDINARY_API_KEY, 
  //api_secret: process.env.CLOUDINARY_API_SECRET
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

//root will be the home page with search form
router.get("/", function(req, res){
    res.render("writings/index");
});  

//Presenting Writing.index page
router.get("/writings/index", function(req, res){
   res.render("writings/index");
}); 

//register route - present the register form
router.get("/register", function(req, res){
   res.render("register");
}); 

//register route for the admin - present the register form
router.get("/admin-register", function(req, res){
   res.render("users/admin-register");
}); 

//to register the user
router.post("/register", upload.single('avatar'), function(req, res){
    cloudinary.uploader.upload(req.file.path, function(result) {
        var username = req.body.username;
        var avatar = result.secure_url;
        var firstName = req.body.firstName;
        var lastName = req.body.lastName;
        var about = req.body.about;
        var email = req.body.username;
        var adminCode = req.body.adminCode;
      
        var newUser = {username: username, avatar: avatar, firstName: firstName, lastName: lastName, about:about, email:email, adminCode:adminCode};
       
       //creates a new user and pass in the password seperately and database keep the password as a huge string
        if (req.body.adminCode === 'power'){
            newUser.isAdmin = true;
        }   
        //console.log(newUser);
        //eval(require('locus'));
        User.register(newUser, req.body.password, function(err, user){
            
            if (err || !user) {
                console.log("I am in error!!!");
                console.log(err);
                console.log(user);
                req.flash("error", err.message);
                return res.redirect("/register");
            } 
            //logs the user in using the local strategy
            passport.authenticate("local")(req, res, function(){
                req.flash("success", "Welcome to Josh Chacko's world of writing!");
                res.redirect("/writings/index");
            });
       });
    });
});     

//LOGIN ROUTES - render login form
router.get("/login", function(req, res){
   res.render("login");
});

//LOGIN - POST - Middleware - sits between begin and end
//passport will have the username and password
router.post("/login", passport.authenticate("local", {
    successRedirect: "/writings/index",
    failureFlash: 'Incorrect Email address/Password. Please enter the correct Email address/Password.',
    failureRedirect: "/login",
    successFlash: 'Welcome to the World of Writing!'
}), function(req, res){
});

//LOGOUT
router.get("/logout", function(req, res){
    //destroying all user data from the session 
   req.logout();
   req.flash("success", "Logged you out!");
   res.redirect("/writings/index");
});

//FORGOT PASSWORD
router.get("/forgot", function(req, res){
   res.render("forgot");
});

router.post("/forgot", function(req, res, next){
    async.waterfall([
        function(done) {
            crypto.randomBytes(20, function(err, buf) {
                var token = buf.toString('hex');
                done(err, token);//link for the user to click
            });
        },
        function(token, done) {
            User.findOne({email:req.body.email}, function(err, user) {
                if (!user) {
                    req.flash('error', "No account with that email address esists");
                    return res.redirect('/forgot');
                    
                }
                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; //1 hour
                
                user.save(function(err){
                    done(err, token, user);
                });
            });
        },    
        function(token, user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: process.env.EMAIL_SERVICE,
                auth: {
                    user: process.env.EMAIL_ID,
                    pass: process.env.EMAIL_PASSWORD
             }
            });
            var mailOptions = {
                    to: user.email,
                    from: process.env.EMAIL_ID,
                    subject: 'Josh Chacko Password Reset',
                    text: 'Hello, \n\n' +
                        'You are receiving this email because you have requested the reset of the password for the Josh Chacko\'s Writing page. ' +
                        'Please click on the following link, or paste this into your browser to complete the process. ' +
                        'https://' + req.headers.host + '/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.' + '\n\n\n' +
                    'The Site Admin.'
            };
            smtpTransport.sendMail(mailOptions, function(err){
                req.flash('success', 'An email has been sent to ' + user.email + ' with further instructions to reset your password.')
                done(err, 'done');
            });
          }    
        ], function (err) {
            if (err) return next(err);
            res.redirect('/forgot');
    });
});

//PASSWORD RESET PAGE RENDERING
router.get("/reset/:token", function(req, res){
    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() }}, function(err, user) {
        if (!user) {
            req.flash('error', 'Password reset token is invlaid or has expires.');
            return res.redirect('/forgot');
        }
        res.render('reset', {token: req.params.token});
    });
});

//PASSWORD RESET PROCESS
router.post("/reset/:token", function(req, res, next){
    async.waterfall([
        function(done) {
            User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() }}, function(err, user) {
                if (!user) {
                    req.flash('error', 'Password reset token is invalid or has expired.');
                    return res.redirect('/back');
                }
                if(req.body.password === req.body.confirm) {
                    user.setPassword(req.body.password, function(err) {
                        user.resetPasswordToken = undefined;
                        user.resetPasswordExpires = undefined;
                        
                        user.save(function(err) {
                            req.login(user, function(err) {
                                done(err, user);
                            });
                        });
                    });
                } else {
                    req.flash("error", "Passwords do not match.");
                    return res.redirect('back');
                }
            });
          }, 
          function(user, done) {
              var smtpTransport = nodemailer.createTransport({
                  service: 'Gmail',
                  auth: {
                        user: process.env.EMAIL_ID,
                        //pass: process.env.GMAILPW
                        pass: process.env.EMAIL_PASSWORD
                  }
              });
              var mailOptions = {
                to: user.email,
                from: process.env.EMAIL_ID,
                subject: 'Your password has been changed',
                text: 'Hello, \n\n' +
                    'This is a confirmation that your Josh Chacko password for account ' + user.email + ' has just been reset.' + '\n\n\n' +
                    'The Site Admin.'
              };
              smtpTransport.sendMail(mailOptions, function(err){
                req.flash('success', 'Success! Your password has been changed.');
                done(err, 'done');
            });
          }    
        ], function (err) {
            res.redirect('/writings/index');
     });
});

//USER PUBLIC PROFILE - finding all poems and prose associated to the
router.get('/users/:id', async function(req, res) {
  try {
    let user = await User.findById(req.params.id).populate("followers").exec();
    
    Poem.find().where('author.id').equals(user._id).exec(function(err, poems){
    if (err) {
        req.flash("error", "Poems Not found");
        res.redirect("back");
    } 
    
    Prose.find().where('author.id').equals(user._id).exec(function(err, proses){
    if (err) {
        req.flash("error", "Prose Not found");
        res.redirect("back");
    } 
    
    res.render("users/show", {user: user, poems:poems, proses:proses});
    
    });
    });
    
  } catch(err) {
    req.flash('error', err.message);
    return res.redirect('back');
  }
});

//USER PFOFILE EDIT PAGE RENDERING
router.get("/edit-profile", function(req, res){
   res.render("edit-profile");
});

//UPDATE USER PROFILE
router.post("/users/:id", upload.single('currentUser[avatar]'), function(req, res) {
    cloudinary.uploader.upload(req.file.path, function(result) {
        
        req.body.currentUser.avatar = result.secure_url;
        
        if (req.isAuthenticated()) {
            User.findByIdAndUpdate(req.params.id, req.body.currentUser, function(err,updatedUser) {
                 if (err || !updatedUser) {
                    console.log("I am Inside the error!!!"); 
                    req.flash("error", "User not found");
                    res.redirect("/writings/index");
                } else {
                    req.flash("success", "User profile updated.");  
                    res.redirect("/writings/index");
                } 
            });
        } else {
                req.flash("error", "You need to be logged in to perform this function");
                res.redirect("back");
        } 
    });    
});  

//  follow user
router.get('/follow/:id', middleware.isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.params.id);
    //Checking to see whether the user is already following 
    var found = false;
    for(var i = 0; i < user.followers.length; i++) {
        if (user.followers[i]._id.equals(req.user._id)) {
            found = true;
            break;
        }
    }
    
    if (!found) {
        user.followers.push(req.user._id);
        user.save();
        req.flash('success', 'Successfully followed ' + user.username + '!');
        res.redirect('/users/' + req.params.id);
    }
    else {
        req.flash('error', 'You are already a follower of ' + user.username + '!');
        res.redirect('/users/' + req.params.id);
    }
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

//  view all poems notifications
router.get('/notifications', middleware.isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.user._id).populate({
      path: 'notifications',
      options: { sort: { "_id": -1 } }
    }).exec();
    let allNotifications = user.notifications;
    res.render("notifications/index", { allNotifications });
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

// handle notification
router.get('/notifications/:id', middleware.isLoggedIn, async function(req, res) {
  try {
    let notification = await Notification.findById(req.params.id);
    notification.isRead = true;
    notification.save();
    if (notification.poemId) {
        res.redirect(`/poems/${notification.poemId}`);
    } else {
        if (notification.proseId) {
            res.redirect(`/proses/${notification.proseId}`);
        }    
    }    
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

module.exports = router;