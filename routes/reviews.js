var express = require("express");
var router = express.Router({mergeParams: true});
var Poem = require("../models/poem");
var Prose = require("../models/prose");
var Review = require("../models/review");
var middleware = require("../middleware");
var validator   = require("express-validator/check");

// Poems Reviews Index
router.get("/poems/:id/reviews", [validator.param('id').isMongoId().trim()], function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/poems/index");
    }
    else {    
        Poem.findById(req.params.id).populate({
            path: "reviews",
            options: {sort: {createdAt: -1}} // sorting the populated reviews array to show the latest first
        }).exec(function (err, poem) {
            if (err || !poem) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            res.render("poem-reviews/index", {poem: poem});
        });
    }    
});

// Prose Reviews Index
router.get("/proses/:id/reviews", [validator.param('id').isMongoId().trim()], function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/proses/index");
    }
    else {    
        Prose.findById(req.params.id).populate({
            path: "reviews",
            options: {sort: {createdAt: -1}} // sorting the populated reviews array to show the latest first
        }).exec(function (err, prose) {
            if (err || !prose) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            res.render("prose-reviews/index", {prose: prose});
        });
    }    
});

// Poem Reviews New
router.get("/poems/:id/reviews/new", [validator.param('id').isMongoId().trim()], middleware.isLoggedIn, middleware.checkReviewExistenceForPoem, function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/poems/index");
    }
    else {
        // middleware.checkReviewExistence checks if a user already reviewed the poem, only one review per user is allowed
        Poem.findById(req.params.id, function (err, poem) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            res.render("poem-reviews/new", {poem: poem});
        });
    }    
});

// Prose Reviews New
router.get("/proses/:id/reviews/new", [validator.param('id').isMongoId().trim()], middleware.isLoggedIn, middleware.checkReviewExistenceForProse, function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/proses/index");
    }
    else {
        // middleware.checkReviewExistence checks if a user already reviewed the prose, only one review per user is allowed
        Prose.findById(req.params.id, function (err, prose) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            res.render("prose-reviews/new", {prose: prose});
        });
    }    
});

// Poem Reviews Create
router.post("/poems/:id/reviews", [validator.param('id').isMongoId().trim()], middleware.isLoggedIn, middleware.checkReviewExistenceForPoem, function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/poems/index");
    }
    else {
        //lookup poems using ID
        Poem.findById(req.params.id).populate("reviews").exec(function (err, poem) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            Review.create(req.body.review, function (err, review) {
                if (err) {
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
                //add author username/id and associated poem to the review
                review.author.id = req.user._id;
                review.author.email = req.user.email;
                review.author.firstName = req.user.firstName;
                review.author.lastName = req.user.lastName;
                review.poem = poem;
                //save review
                review.save();
                poem.reviews.push(review);
                // calculate the new average review for the poem
                poem.rating = calculateAverage(poem.reviews);
                //save poem
                poem.save();
                req.flash("success", "Your review has been successfully added.");
                res.redirect('/poems/' + poem._id);
            });
        });
    }    
});

// Prose Reviews Create
router.post("/proses/:id/reviews", [validator.param('id').isMongoId().trim()], middleware.isLoggedIn, middleware.checkReviewExistenceForProse, function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/proses/index");
    }
    else {
        //lookup prose using ID
        Prose.findById(req.params.id).populate("reviews").exec(function (err, prose) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            Review.create(req.body.review, function (err, review) {
                if (err) {
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
                //add author username/id and associated prose to the review
                review.author.id = req.user._id;
                review.author.email = req.user.email;
                review.author.firstName = req.user.firstName;
                review.author.lastName = req.user.lastName;
                review.rose = prose;
                //save review
                review.save();
                prose.reviews.push(review);
                // calculate the new average review for the prose
                prose.rating = calculateAverage(prose.reviews);
                //save prose
                prose.save();
                req.flash("success", "Your review has been successfully added.");
                res.redirect('/proses/' + prose._id);
            });
        });
    }    
});

// Poem Reviews Edit
router.get("/poems/:id/reviews/:review_id/edit", [validator.param('id').isMongoId().trim()], middleware.checkReviewOwnership, function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/poems/index");
    }
    else {
        Review.findById(req.params.review_id, function (err, foundReview) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            res.render("poem-reviews/edit", {poem_id: req.params.id, review: foundReview});
        });
    }    
});

// Prose Reviews Edit
router.get("/proses/:id/reviews/:review_id/edit", [validator.param('id').isMongoId().trim()], middleware.checkReviewOwnership, function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/proses/index");
    }
    else {
        Review.findById(req.params.review_id, function (err, foundReview) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            res.render("prose-reviews/edit", {prose_id: req.params.id, review: foundReview});
        });
    }    
});


// Poems Reviews Update
router.put("/poems/:id/reviews/:review_id", [validator.param('id').isMongoId().trim()], middleware.checkReviewOwnership, function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/poems/index");
    }
    else {
        Review.findByIdAndUpdate(req.params.review_id, req.body.review, {new: true}, function (err, updatedReview) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            Poem.findById(req.params.id).populate("reviews").exec(function (err, poem) {
                if (err) {
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
                // recalculate poem average
                poem.rating = calculateAverage(poem.reviews);
                //save changes
                poem.save();
                req.flash("success", "Your review was successfully edited.");
                res.redirect('/poems/' + poem._id);
            });
        });
    }    
});

// Prose Reviews Update
router.put("/proses/:id/reviews/:review_id", [validator.param('id').isMongoId().trim()], middleware.checkReviewOwnership, function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/proses/index");
    }
    else {
        Review.findByIdAndUpdate(req.params.review_id, req.body.review, {new: true}, function (err, updatedReview) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            Prose.findById(req.params.id).populate("reviews").exec(function (err, prose) {
                if (err) {
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
                // recalculate prose average
                prose.rating = calculateAverage(prose.reviews);
                //save changes
                prose.save();
                req.flash("success", "Your review was successfully edited.");
                res.redirect('/proses/' + prose._id);
            });
        });
    }    
});

// Poem Reviews Delete
router.delete("/poems/:id/reviews/:review_id", [validator.param('id').isMongoId().trim()], middleware.checkReviewOwnership, function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/poems/index");
    }
    else {
        Review.findByIdAndRemove(req.params.review_id, function (err) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            Poem.findByIdAndUpdate(req.params.id, {$pull: {reviews: req.params.review_id}}, {new: true}).populate("reviews").exec(function (err, poem) {
                if (err) {
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
                // recalculate poem average
                poem.rating = calculateAverage(poem.reviews);
                //save changes
                poem.save();
                req.flash("success", "Your review poem was deleted successfully.");
                res.redirect("/poems/" + req.params.id);
            });
        });
    }    
});

// Prose Reviews Delete
router.delete("/proses/:id/reviews/:review_id", [validator.param('id').isMongoId().trim()], middleware.checkReviewOwnership, function (req, res) {
    var errors = validator.validationResult(req);
    
    if (!errors.isEmpty() ) {
       req.flash("error", "Page not found");
       res.redirect("/proses/index");
    }
    else {
        Review.findByIdAndRemove(req.params.review_id, function (err) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            Prose.findByIdAndUpdate(req.params.id, {$pull: {reviews: req.params.review_id}}, {new: true}).populate("reviews").exec(function (err, prose) {
                if (err) {
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
                // recalculate poem average
                prose.rating = calculateAverage(prose.reviews);
                //save changes
                prose.save();
                req.flash("success", "Your prose review was deleted successfully.");
                res.redirect("/proses/" + req.params.id);
            });
        });
    }    
});

function calculateAverage(reviews) {
    if (reviews.length === 0) {
        return 0;
    }
    var sum = 0;
    reviews.forEach(function (element) {
        sum += element.rating;
    });
    return sum / reviews.length;
}

module.exports = router;