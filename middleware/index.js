var middlewareObj = {};
var Poem = require("../models/poem");
var Prose = require("../models/prose");
var Review = require("../models/review");

middlewareObj.isLoggedIn = function(req, res, next){
    if (req.isAuthenticated()){
        return next();
    }
    //Flash wikk show up on the next page
    req.flash("error", "Please Login First!");
    res.redirect("/login");
}

middlewareObj.checkReviewOwnership = function(req, res, next) {
    if(req.isAuthenticated()){
        Review.findById(req.params.review_id, function(err, foundReview){
            if(err || !foundReview){
                res.redirect("back");
            }  else {
                // does user own the comment?
                if(foundReview.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back");
    }
};

middlewareObj.checkReviewExistenceForPoem = function (req, res, next) {
    if (req.isAuthenticated()) {
        Poem.findById(req.params.id).populate("reviews").exec(function (err, foundPoem) {
            if (err || !foundPoem) {
                req.flash("error", "Poem not found.");
                res.redirect("back");
            } else {
                // check if req.user._id exists in reviews
                var foundUserReview = foundPoem.reviews.some(function (review) {
                    return review.author.id.equals(req.user._id);
                });
                if (foundUserReview) {
                    req.flash("error", "You have already wrote a review. Please edit your review if needed.");
                    return res.redirect("/poems/" + foundPoem._id);
                }
                // if the review was not found, go to the next middleware
                next();
            }
        });
    } else {
        req.flash("error", "You need to login first.");
        res.redirect("back");
    }
};

middlewareObj.checkReviewExistenceForProse = function (req, res, next) {
    if (req.isAuthenticated()) {
        Prose.findById(req.params.id).populate("reviews").exec(function (err, foundProse) {
            if (err || !foundProse) {
                req.flash("error", "Prose not found.");
                res.redirect("back");
            } else {
                // check if req.user._id exists in reviews
                var foundUserReview = foundProse.reviews.some(function (review) {
                    return review.author.id.equals(req.user._id);
                });
                if (foundUserReview) {
                    req.flash("error", "You have already wrote a review. Please edit your review if needed.");
                    return res.redirect("/proses/" + foundProse._id);
                }
                // if the review was not found, go to the next middleware
                next();
            }
        });
    } else {
        req.flash("error", "You need to login first.");
        res.redirect("back");
    }
};

module.exports = middlewareObj;