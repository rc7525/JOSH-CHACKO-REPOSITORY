var express     = require("express");
var router      = express.Router();
var Prose       = require("../models/prose");
var User        = require("../models/user");
var Notification = require("../models/notification");
var Review      = require("../models/review");
var validator   = require("express-validator/check");
var methodOverride = require("method-override");
var middleware  = require("../middleware");
var multer      = require('multer');
var async       = require("async");

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
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

//INDEX ROUTE - get prose 
router.get("/proses/index", function(req, res){
    //fuzzy search - req-query will have the search criteria
    var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    var noMatch = null;
    
    if(req.query.search){
        const regExp = new RegExp(escapeRegExp(req.query.search), 'gi');
        Prose.find({name: regExp}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allProse) {
            Prose.count({name: regExp}).exec(function (err, count) {
                if (err){
                    console.log(err);
                    res.redirect("back");
                } else {
                    if(allProse.length < 1) {
                        req.flash("error", "No Prose match your search criteria. Please try again.");
                        res.redirect("/proses/index");
                    } else {
                        res.render("proses/index", {proses:allProse,
                            current: pageNumber,
                            pages: Math.ceil(count / perPage),
                            noMatch: noMatch,
                            search: req.query.search
                        });
                    }    
                 } 
            });     
        });
    } else {
        //get all prose fron DB
        Prose.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allProse) {
            Prose.count().exec(function (err, count) {
            if (err){
                console.log(err);
            } else {
                res.render("proses/index", {proses:allProse,
                    proses: allProse,
                    current: pageNumber,
                    pages: Math.ceil(count / perPage),
                    noMatch: noMatch,
                    search: false
                });
            } 
        });
      });    
    }    
}); 

//NEW ROUTE - new page to submit a new prose -new should be defined prior to /:id
router.get("/proses/new", middleware.isLoggedIn, function(req, res){
    res.render("proses/new");
});

//CREATE ROUTE - post new prose - 
router.post("/proses", middleware.isLoggedIn, upload.single('image'), async function(req, res){
    var image = "";
    
    if (!isEmptyObject('image')) {
        await cloudinary.uploader.upload(req.file.path, async function(result) {
            image = result.secure_url;
        });    
    } 
    
  var name = req.body.name;
  var body = req.body.body;
  // add author to prose
  var author = {
    id: req.user._id,
    email: req.user.email,
    firstName: req.user.firstName,
    lastName: req.user.lastName
  }
  var newProse = {name: name, image: image, body: body, author:author};
  
  try {
      let prose = await Prose.create(newProse);
      let user = await User.findById(req.user._id).populate('followers').exec();
      let newNotification = {
        email: req.user.email,
        proseId: prose.id,
        proseName: name
      }
      for(const follower of user.followers) {
        let notification = await Notification.create(newNotification);
        follower.notifications.push(notification);
        follower.save();
      }
      //redirect back to prose page
      res.redirect(`/proses/${prose.id}`);
    } catch(err) {
        req.flash("error", err.message);
        res.redirect('back');
    }
});

//SHOW ROUTE - Details about one item
router.get("/proses/:id", [validator.param('id').isMongoId().trim()], function(req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
      req.flash("error", "Page not found");
      res.redirect("/proses/index");
    }
    else {
        //finding prose and populating the reviews associated  
         Prose.findById(req.params.id).
            populate({
                path: "reviews",
                options: {sort: {createAt: -1}}
            }).exec(function(err,foundProse) {
         if (err || !foundProse) {
            req.flash("error", "Prose not found");
            res.redirect("/proses/index");
         } else {
            //render show template with that prose
            res.render("proses/show", {prose:foundProse});
         } 
        });
    }
});

//EDIT ROUTE
router.get("/proses/:id/edit", [validator.param('id').isMongoId().trim()], function(req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
        req.flash("error", "Page not found");
        res.redirect("/proses/index");
    }
    else {
        //finding prose and populating the reviews associated 
        if (req.isAuthenticated()) {
            Prose.findById(req.params.id, function(err,foundProse) {
                 if (err || !foundProse) {
                    req.flash("error", "Prose not found");
                    res.redirect("back");
                } else {
                    if (foundProse.author.id.equals(req.user._id) || req.user.isAdmin) {
                        res.render("proses/edit", {prose:foundProse});
                    } else {
                        req.flash("error", "Your permission is not allowing to perform this function");
                        res.redirect("back");
                    }    
                } 
            });
        } else {
            req.flash("error", "You need to be logged in to perform this function");
            res.redirect("back");
        }    
    }
});

//UPDATE ROUTE - update the details about one item
router.put("/proses/:id", upload.single('prose[image]'), [validator.param('id').isMongoId().trim()], async function(req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
        req.flash("error", "Page not found");
        res.redirect("/proses/index");
    }
    else {
        if (req.isAuthenticated()) {
            if (!isEmptyObject('prose[image]')) {
                await cloudinary.uploader.upload(req.file.path, async function(result) {
                    req.body.prose.image = result.secure_url;
                });
            }
            
            Prose.findByIdAndUpdate(req.params.id, req.body.prose, function(err,updatedProse) {
                 if (err || !updatedProse) {
                    req.flash("error", "Prose not found");
                    res.redirect("/proses/index");
                } else {
                    if (updatedProse.author.id.equals(req.user._id) || req.user.isAdmin) {
                        res.redirect("/proses/" + req.params.id);
                    } else {
                        req.flash("error", "Your permission is not allowing to perform this function");
                        res.redirect("back");
                    }    
                } 
            });
        } else {
            req.flash("error", "You need to be logged in to perform this function");
            res.redirect("back");
        }    
    }
});

//DELETE ROUTE - Delete the item
router.delete("/proses/:id", [validator.param('id').isMongoId().trim()], function(req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
        req.flash("error", "Page not found");
        res.redirect("/proses/index");
    }
    else {
      if (req.isAuthenticated()) {  
          Prose.findById(req.params.id, function(err, prose) {
              if (err || !prose) {
                  req.flash("error", "Prose not found");
                  res.redirect("/proses/index");
              } else {
                  if (prose.author.id.equals(req.user._id) || req.user.isAdmin) {
                    Review.remove({
                        "_id": { $in: prose.reviews } 
                        }, function (err) {
                        if (err) {
                          req.flash("error", "Not able to delete prose reviews");    
                          res.redirect("/proses/index");
                         } else {
                             prose.remove();
                             res.redirect("/proses/index");
                        } 
                    });
                  } else {
                      req.flash("error", "Your permission is not allowing to perform this function");
                      res.redirect("back");
                  }// checking author.id = req.user._id
              }
         });
      } else {
          req.flash("error", "You need to be logged in to perform this function");
          res.redirect("back");
      }
    }
});

function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function escapeRegExp(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

//Check to see whether an object is empty
function isEmptyObject(obj) {
  return !Object.keys(obj).length;
}

module.exports = router;