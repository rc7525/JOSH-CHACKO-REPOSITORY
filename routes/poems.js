var express     = require("express");
var router      = express.Router();
var Poem        = require("../models/poem");
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

//INDEX ROUTE - get poems 
router.get("/poems/index", function(req, res){
    //fuzzy search - req-query will have the search criteria
    var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    var noMatch = null;
    
    if(req.query.search){
        const regExp = new RegExp(escapeRegExp(req.query.search), 'gi');
        Poem.find({name: regExp}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allPoems) {
            Poem.count({name: regExp}).exec(function (err, count) {
                if (err){
                    console.log(err);
                    res.redirect("back");
                } else {
                    if(allPoems.length < 1) {
                        req.flash("error", "No Poems match your search criteria. Please try again.");
                        res.redirect("/poems/index");
                    } else {
                        res.render("poems/index", {poems:allPoems,
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
        //get all poems fron DB
        Poem.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allPoems) {
            Poem.count().exec(function (err, count) {
            if (err){
                console.log(err);
            } else {
                res.render("poems/index", {poems:allPoems,
                    poems: allPoems,
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

//NEW ROUTE - new page to submit a new poems -new should be defined prior to /:id
router.get("/poems/new", middleware.isLoggedIn, function(req, res){
    res.render("poems/new");
});


//CREATE ROUTE - post new poems - 
router.post("/poems", middleware.isLoggedIn, upload.single('image'), async function(req, res){
    var image = "";
    
    if (!isEmptyObject('image')) {
        await cloudinary.uploader.upload(req.file.path, async function(result) {
            image = result.secure_url;
        });    
    } 
    
  var name = req.body.name;
  var body = req.body.body;
  // add author to poem
  var author = {
    id: req.user._id,
    email: req.user.email,
    firstName: req.user.firstName,
    lastName: req.user.lastName
  }
  var newPoem = {name: name, image: image, body: body, author:author};
  
  try {
      let poem = await Poem.create(newPoem);
      let user = await User.findById(req.user._id).populate('followers').exec();
      let newNotification = {
        email: req.user.email,
        poemId: poem.id,
        poemName: name
      }
      for(const follower of user.followers) {
        let notification = await Notification.create(newNotification);
        follower.notifications.push(notification);
        follower.save();
      }
      //redirect back to poems page
      res.redirect(`/poems/${poem.id}`);
    } catch(err) {
        req.flash('error', err.message);
        res.redirect('back');
    }
});

//SHOW ROUTE - Details about one item
router.get("/poems/:id", [validator.param('id').isMongoId().trim()], function(req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
      req.flash("error", "Page not found");
      res.redirect("/poems/index");
    }
    else {
        //finding poems and populating the reviews associated  
         Poem.findById(req.params.id).
            populate({
                path: "reviews",
                options: {sort: {createAt: -1}}
            }).exec(function(err,foundPoem) {
         if (err || !foundPoem) {
            req.flash("error", "Poem not found");
            res.redirect("/poems/index");
         } else {
            //render show template with that poem
            res.render("poems/show", {poem:foundPoem});
         } 
        });
    }
});

//EDIT ROUTE
router.get("/poems/:id/edit", [validator.param('id').isMongoId().trim()], function(req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
        req.flash("error", "Page not found");
        res.redirect("/poems/index");
    }
    else {
        //finding poems and populating the reviews associated 
        if (req.isAuthenticated()) {
            Poem.findById(req.params.id, function(err,foundPoem) {
                 if (err || !foundPoem) {
                    req.flash("error", "Poem not found");
                    res.redirect("back");
                } else {
                    if (foundPoem.author.id.equals(req.user._id) || req.user.isAdmin) {
                        res.render("poems/edit", {poem:foundPoem});
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
router.put("/poems/:id", upload.single('poem[image]'), [validator.param('id').isMongoId().trim()], async function(req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
        req.flash("error", "Page not found");
        res.redirect("/poems/index");
    }
    else {
        if (req.isAuthenticated()) {
            if (!isEmptyObject('poem[image]')) {
                await cloudinary.uploader.upload(req.file.path, async function(result) {
                    req.body.poem.image = result.secure_url;
                });
            }
            
            Poem.findByIdAndUpdate(req.params.id, req.body.poem, function(err,updatedPoem) {
                 if (err || !updatedPoem) {
                    req.flash("error", "Poem not found");
                    res.redirect("/poems/index");
                } else {
                    if (updatedPoem.author.id.equals(req.user._id) || req.user.isAdmin) {
                        res.redirect("/poems/" + req.params.id);
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
router.delete("/poems/:id", [validator.param('id').isMongoId().trim()], function(req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
        req.flash("error", "Page not found");
        res.redirect("/poems/index");
    }
    else {
      if (req.isAuthenticated()) {  
          Poem.findById(req.params.id, function(err,poem) {
              if (err || !poem) {
                  req.flash("error", "Poem not found");
                  res.redirect("/poems/index");
              } else {
                  if (poem.author.id.equals(req.user._id) || req.user.isAdmin) {
                    Review.remove({
                        "_id": { $in: poem.reviews } 
                        }, function (err) {
                        if (err) {
                          req.flash("error", "Not able to delete poem reviews");    
                          res.redirect("/poems/index");
                         } else {
                             poem.remove();
                             res.redirect("/poems/index");
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