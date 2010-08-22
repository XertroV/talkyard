// vim: fdm=marker et ts=2 sw=2

// In this file:
// - jQuery extension functinos, prefixed with "dw_" to avoid name clashes
// - The implementation of the Debiki module
// - A jQuery onload handler

Debiki = {};  // TODO: Error handling?
Debiki.v0 = {};

//========================================
   (function(){
//========================================

//----------------------------------------
// jQuery object extensions
//----------------------------------------

jQuery.fn.dw_disable = function() {
  return this.each(function(){ jQuery(this).attr('disabled', 'disabled'); });
};

jQuery.fn.dw_enable = function() {
  return this.each(function(){ jQuery(this).removeAttr('disabled'); });
};

jQuery.fn.dw_postModTime = function() {
  return this.find(
      '.dw-post-info .dw-last-changed .dw-date').attr('title');
};

//----------------------------------------
// Implement public functions
//----------------------------------------

var Settings = {};

Settings.makeEditUrl = function(debateId, postId) {
  // Default:
  return debateId +'/edits/proposed/post/'+ postId +'.html'
};

Settings.makeRatePostUrl = function(debateId, postId) {
  // Default:
  // (Firefox doesn't accept an Ajax post request "" (i.e. the same page);
  // nsIXMLHttpRequest.open fails with NS_ERROR_ILLEGAL_VALUE.)
  return '?';
};

Settings.makeReplyUrl = function(debateId, postId) {
  return '?';
}

//----------------------------------------
// Export functions
//----------------------------------------

// A function that builds the GET line to download edit suggestions
// for a certain post.
Debiki.v0.setEditUrl = function(urlBuilder) {
  Settings.makeEditUrl = urlBuilder;
};

Debiki.v0.setRatePostUrl = function(urlBuilder) {
  Settings.makeRatePostUrl = urlBuilder;
};

Debiki.v0.setReplyUrl = function(urlBuilder) {
  Settings.makeReplyUrl = urlBuilder;
};

// Onload
//----------------------------------------
   jQuery.noConflict()(function($){
//----------------------------------------

var threadHovered = null;
var didResize = false;
var posts = $(".debiki .dw-cmt-bdy");
var rateFormTemplate = $("#dw-hidden-templates .dw-fs-rat");
var debateId = $('.debiki').attr('id');


// ------- Open/close

// Open/close threads if the thread-info div is clicked.
$('.debiki').delegate('.dw-cmt-x', 'click', function() {
  var thread = $(this).closest(".dw-cmt");
  resizeRootThreadExtraWide();
  thread.
    find('> :not(.dw-cmt-wrap, .dw-cmt-x), '+
        '> .dw-cmt-wrap > .dw-cmt-bdy, '+
        '> .dw-act').
      //add(thread.find('> .dw-cmt-wrap > .dw-cmt-bdy')).
      stop(true,true).
      slideToggle(800).
      //queue(function(next){
      //    thread
      //      .toggleClass('dw-collapsed')
      //      .toggleClass('dw-collapsed-fx', 600);
      //    next();
      //  }).
      queue(function(next){ resizeRootThreadNowAndLater(); next(); }).
    end().
    children(".dw-cmt-x").
      each(function(){
        // The – is not a - but an &endash;.
        var newText = $(this).text().indexOf('+') == -1 ? '[+]' : '[–]';
        $(this).text(newText);
      });
});


// ------- Outlining

// Outline new posts
(function(){
  var myLastVersion = $.cookie('myLastPageVersion');
  if (!myLastVersion) return;
  var newPosts = posts.filter(function(index){
    return $(this).dw_postModTime() > myLastVersion;
  })
  newPosts.closest('.dw-cmt').addClass('dw-post-new');
  // TODO: sometimes .dw-post-edited instead of -new
})()


// ------- Resizing

// Makes the root thread wide enough to contain all its child posts.
// Is this not done e.g. when child posts are resized or stacked eastwards,
// or a reply/rate/edit form is shown/resized, the east-most threads
// will float-drop below the other threads.
var resizeRootThreadImpl = function(extraWidth){
  if (extraWidth === true) extraWidth = 1000; // 3 x reply/edit form width
  else {
    // If a user drag-resizes a form quicker than this amount of pixels
    // per browser refresh, div-drop might happen anyway, because
    // this function isn't invoked until after the
    // browser has decided to float-drop the divs?
    // Also, zooming in/out might cause float drop (it seems all elems
    // aren't scaled exactly in the same way), if too small.
    // Hence it's a rather wide value. (Otherwise = 50 would do.)
    extraWidth = 150;
  }
  var width = extraWidth;
  var $root = $('.dw-depth-0');
  if (!$root.length) $root = $('.dw-debate'); // there's no root reply
  $root.find('> .dw-cmts > .dw-cmt, > .dw-fs').each(function(){
    width += $(this).outerWidth(true);
  });
  $root.css('min-width', width +'px');
}

// Makes the root thread wide enough to contain all its child posts.
// Is this not done e.g. when child posts are resized or stacked eastwards,
// or a reply/rate/edit form is shown/resized, the east-most threads
// will float-drop below the other threads.
var resizeRootThread = function(){
  resizeRootThreadImpl();
}

// Resizes the root thread so it becomes extra wide.
// This almost avoids all float drops, when quickly resizing an element
// (making it larger).
var resizeRootThreadExtraWide = function() {
  resizeRootThreadImpl(true);
}

// Export resize functions, for debugging.
// (Otherwise too late to export from here, inside onload event?)
Debiki.v0.resizeRootThread = resizeRootThread;
Debiki.v0.resizeRootThreadExtraWide = resizeRootThreadExtraWide;

// After an elem has been resized, the root thread is resized by
// a call to resizeRootThread(). However, it seems the browser
// (Google Chrome) calls that function before all elements
// are in their final position, in some weird manner, causing
// floats to drop, as if resizeRootThread() had not been called.
// This can be fixed by calling resizeRootThread() again,
// after a while when the browser is (probably) done
// doing its layout stuff.
var resizeRootThreadNowAndLater = (function(){
  var handle;
  return function() {
    resizeRootThread();
    if (handle) clearTimeout(handle);
    handle = setTimeout(resizeRootThread, 1500);
  }
})();

// Makes [threads layed out vertically] resizable.
function $makeEastResizable() {
  $(this).resizable({
    resize: resizeRootThreadExtraWide,
    handles: 'e',
    stop: function(event, ui) {
      // jQuery has added `height: ...' to the thread's style attribute.
      // Unless removed, the therad won't resize itself when child
      // threads are opened/closed.
      $(this).css('height', null);
      resizeRootThreadNowAndLater();
    }
  });
}

// Make posts and threads resizable.
// Fails with a TypeError on Android: Cathching it and ignoring it.
// (On Android, posts and threads won't be resizable.)
function $makePostResizable() {
  try {
  // Indicate which posts are cropped, and make visible on click.
  $(this)
    .filter('.dw-x-s')
    .append(
      '<div class="dw-x-mark">. . . truncated</div>')
    .click(function(){
      console.log('click: Removing cropped-s.');
      // (Some rather long posts are cropped, using max-width and -height.
      // Don't remove max-width, or some posts might end up rather wide.)
      $(this).removeClass('dw-x-s');
    })
  .end()
  .resizable({
      autoHide: true,
      start: function(event, ui) {
        // Remove max height and width restrictions.
        $(this).closest('.dw-cmt-wrap').removeClass('dw-x-s dw-x-e');
        didResize = true;
      }
     })
  .find('.ui-resizable-se')
    // Make the resize grip larger.
    .removeClass('.ui-icon-gripsmall-diagonal-se')  // exchange small grip...
    .addClass('ui-icon-grip-diagonal-se')  // ...against the normal one
  .end()
  // Remove max-height and -width when mouse *up* on the resize-e handle.
  // (This is a shortcut to reveal the whole post - only triggered if
  // *clicking* the resize handle, but not dragging it.)
  .find('.ui-resizable-e')
    .mouseup(function(){
      // (Removing only max-width usually results in nothing:
      // The thread usually has a max-width.).
      var post = $(this).closest('.dw-cmt-wrap');
      post.removeClass('dw-x-s dw-x-e');
      // Expand post eastwards if resize handle was clicked not dragged.
      // (Also expands southwards, but browsers usually expand to east first.)
      if (!didResize) post.css('width', null).css('height', null);
    })
  .end()
  .find('.ui-resizable-s, .ui-resizable-se')
    // Expand post southwards if resize handle was clicked not dragged.
    .mouseup(function(){
      if (!didResize) $(this).closest('.dw-cmt-wrap').css('height', null);
    })
  .end()
  .find('.ui-resizable-handle')
    .mousedown(function(){
      didResize = false;
    })
  .end();
  }
  catch (e) {
    if (e.name == 'TypeError') console.log(e.name +': Failed to make '+
        'post resizable. Ignoring error (this is a smartphone?)');
    else throw e;
  }
}

// ------- Update

// Finds new/updated versions of posts/edits in newDebateHtml,
// adds them / replaces [the currently displayed but out-of-date versions].
// Highlights the changes done.
// Does not reorder elems currently shown (even if their likeability have
// changed significantly), to avoid surprising the user (by
// shuffling everything around).
function updateDebate(newDebateHtml) {
  var $curDebate = $('.dw-debate');
  var $newDebate = buildTagFind(newDebateHtml, '.dw-debate');
  $newDebate.find('.dw-cmt').each(function(){
      var parentId = $(this).parents('.dw-cmt').attr('id');
      var $oldParent = parentId ? $curDebate.find('#'+ parentId) : $curDebate;
      var $oldThis = $curDebate.find('#'+ this.id);
      var isNewThread = $oldThis.length == 0;
      var isSubThread = !$oldParent.length;
      var isPostEdited = !isNewThread &&
              $oldThis.children('.dw-cmt-wrap').dw_postModTime() <
              $(this).children('.dw-cmt-wrap').dw_postModTime();
      // TODO: Some more jQuery should be registered below, e.g. resizing.
      if (isPostEdited) {
        $(this).children('.dw-cmt-wrap')
          .replaceAll($oldThis.children('.dw-cmt-wrap'))
          .addClass('dw-post-edited'); // outlines it - TODO: Add to cmt not cmt-bdy
      }
      else if (isNewThread && !isSubThread) {
        // (A thread that *is* a sub-thread of another new thread, is added
        // automatically when that other new thread is added.)
        var $res = $oldParent.children('.dw-cmts');
        if (!$res.length) {
          // This is the first reply; create the reply list.
          $res = $("<ol class='dw-cmts'/>").appendTo($oldParent);
        }
        $(this)
          .addClass('dw-post-new') // outlines it, and its sub thread posts
          .prependTo($res)
          .find('.dw-cmt-wrap')
      }
      else
        return;
      $(this).each($initPost);
    })
}

// ------- Forms and actions

// Replace .dw-act links with reply/edit/rate links (visible on hover).
posts.each($initPost);
function $initPost(){
  var $cmt = $(this).closest('.dw-cmt');
  $cmt.find('> .dw-react').replaceWith(
      $('#dw-action-menu > .dw-act')
        .clone()
        .css('visibility', 'hidden'));
  // $makeEastResizable must be called before $makePostResizable,
  // or $makeEastResizable has no effect. No idea why -- my guess
  // is some jQuery code does something similar to `$.find(..)',
  // and finds the wrong resizable stuff,
  // if the *inner* tag is made resizable before the *outer* tag.
  // (Note that $makePostResizable is invoked on a $cmt *child*.)
  $cmt.filter('.dw-depth-1').each($makeEastResizable);
  // Show actions when hovering post.
  // But always show the leftmost Reply, at depth-0, that creates a new column.
  // (Better avoid delegates for frequent events such as mouseenter.)
  $cmt.filter(':not(.dw-depth-0)').children('.dw-cmt-wrap')
    .mouseenter($showActions)
    .each($makePostResizable);
  updateAuthorInfo($cmt, $.cookie('dwUserName'));
}

// Shows actions for the current post, or the last post hovered.
var $lastActions = null;
function $showActions() {
  if ($lastActions) {
    $lastActions.closest('.dw-cmt').children('.dw-act')
      .css('visibility', 'hidden');
  }
  $lastActions = $(this);
  $lastActions.closest('.dw-cmt').children('.dw-act')
    .css('visibility', 'visible');
}

// Action <form> cancel button -- won't work for the Edit form...?
function slideAwayRemove($form) {
  // Slide away <form> and remove it.
  var $parent = $form.parent();
  function rm(next) { $form.remove(); resizeRootThread(); next(); }
  if ($parent.filter('.dw-depth-0, .dw-debate').length)
    $form.hide('fold', 800).queue(rm);
  else $form.slideUp(530).queue(rm);
};

// Remove new-reply and rating forms on cancel, but 
// the edit form has some own special logic.
$('.debiki').delegate(
    '.dw-reply-form .dw-cancel, ' +
    '.dw-rat-form .dw-cancel',
    'click', function(){ slideAwayRemove($(this).closest('.dw-fs')); });

// Slide in reply, edit and rate forms -- I think it's
// easier to understand how they are related to other elems
// if they slide in, instead of just appearing abruptly.
function slideInActionForm($form, $where) { 
  if ($where) {
    // Insert before the first .dw-fs, or the .dw-cmts, or append.
    var $post = $where.closest('.dw-cmt');
    var $oldFormOrCmts = $post.children('.dw-fs, .dw-cmts').filter(':eq(0)');
    if ($oldFormOrCmts.length) $oldFormOrCmts.before($form);
    else $post.append($form);
  }
  else $where = $form.closest('.dw-cmt');
  // Extra width prevents float drop.
  resizeRootThreadExtraWide();
  // Slide in from left, if <form> siblings ordered horizontally.
  // Otherwise slide down (siblings ordered vertically).
  if ($where.filter('.dw-depth-0, .dw-debate').length) $form.show('fold', 800);
  else $form.slideDown(530);
  // Cancel extra width. Or add even more width, to prevent float drops
  // -- needs to be done also when sliding downwards, since that sometimes 
  // makes the root thread child threads wider.
  $form.queue(function(next){
      resizeRootThreadNowAndLater();
      next();
    });
}

// Hide all action forms, since they will be slided in.
$('#dw-hidden-templates .dw-fs').hide();

function dismissActionMenu() {
  $('#dw-action-menu').appendTo($('#dw-hidden-templates'));
}

// ------- User name

// Remembers the user name in a cookie, synchronizes with
// edit/reply forms. Adds .dw-mine class to all posts by someone
// with the new name.
function syncUserName($form) {
  var $nameInput = $form.find("input[name='dw-fi-by']");
  $nameInput.val($.cookie('dwUserName') || 'Anonymous');
  $nameInput.blur(function(){
      var name = $nameInput.val();
      $.cookie('dwUserName', name);
      $('.debiki .dw-cmt').each(function(){
          updateAuthorInfo($(this), name); });
    });
}

function updateAuthorInfo($post, name) {
  var by = $post.find('> .dw-cmt-wrap .dw-cmt-by').text();
  if (by == name) $post.addClass('dw-mine');
}

// Add .dw-mine class to all .dw-cmt:s written by this user.
$('.debiki .dw-cmt').each(function(){
    updateAuthorInfo($(this), $.cookie('dwUserName'));
  });


// ------- Rating

$('.debiki').delegate('.dw-rate', 'click', function() {
  // Warning: Some duplicated code, see .dw-reply and dw-edit click() below.
  var thread = $(this).closest('.dw-cmt');
  clearfix(thread); // ensures the rating appears nested inside the thread
  var $post = thread.children('.dw-cmt-wrap');
  var $rateForm = rateFormTemplate.clone(true); // TODO: Rename to $formWrap?
  var postId = $post.attr('id').substr(8, 999); // drop initial 'dw-post-'
  $rateForm.find("input[name='dw-fi-post']").attr('value', postId);

  // The rating-value inputs are labeled checkboxes. Hence they
  // have ids --- which right now remain the same as the ids
  // in the rateFormTemplate. Make the cloned ids unique:
  makeIdsUniqueUpdateLabels($rateForm, '-post-'+ postId);

  // Enable submit button when ratings specified
  $rateForm.find("input[type='checkbox']").click(function(){
    $rateForm.find("input[type='submit']").button("option", "disabled", false);
  });

  // Set user name input.
  $rateForm.find("input[name='dw-fi-by']").val(
      $.cookie('dwUserName') || 'Anonymous');

  // Ajax-post ratings on submit.
  //  - Disable form until request completed.
  //  - When completed, highlight the user's own ratings.
  $rateForm.submit(function(){
    // Find rating tags selected
    var ratedTags = $rateForm.find("input:checked").map(function(){
      return $(this).val().toLowerCase();
    }).get();

    $.post(Settings.makeRatePostUrl(debateId, postId),
          $rateForm.children('form').serialize(), function(data){

        // Find the new version of the post, with new ratings.
        var $wrap =
            // From jQuery 1.4.2, jQuery.fn.load():
            // Create a dummy div to hold the results
            jQuery('<div />')
            // inject the contents of the document in, removing the scripts
            // to avoid any 'Permission Denied' errors in IE
            .append(data.replace(/<script(.|\s)*?\/script>/gi, ''));
        // Don't lookup by id -- won't work for certain documents
        // (at leat not for JSPWiki pages), because somewhere inside
        // jQuery Sizzle, getElementById returns 'false'.
        // Don't: $wrap.find('#'+ $post.attr('id'));
        // This works:
        var $newPost = $wrap.find('.dw-cmt-wrap[id="dw-post-' + postId + '"]');
        $newPost.replaceAll($post);

        // Highligt the user's ratings.
        $newPost.find('.dw-rats .dw-rat').each(function(){
            // .dw-rat text is e.g. " interesting 80% ". Make lowercase,
            // and drop " 80% ", so tag-name comparison works.
            var text = $(this).text().toLowerCase().replace(/ \d+% /, '');
            for (ix in ratedTags) {
              if ($.trim(text) == ratedTags[ix]) {
                $(this).addClass('dw-you-rated');
                break;
              }
            }
          });

        $newPost.each($initPost);
        slideAwayRemove($rateForm);
      }, 'html');

    $rateForm.find('input').dw_disable();
    return false;
  });

  // Fancy fancy
  // Seems this must be done *after* the rateFormTemplate has been
  // copied --- otherwise, if the Cancel button is clicked,
  // the rateFormTemplate itself has all its jQueryUI markup removed.
  // (Is that a jQuery bug? Only the *clone* ought to be affected?)
  $rateForm.find('.dw-rat-tag-set input, .dw-submit-set input').button();
  // Disable the submit button (until any checkbox clicked)
  $rateForm.find("input[type='submit']").button("option", "disabled", true);
  $rateForm.find('.dw-show-more-rat-tags').
    button().addClass('dw-linkify-ui-state-default');
  // Reveal the form
  slideInActionForm($rateForm, thread);
  dismissActionMenu();
});

// Show more rating tags when clicking the "More..." button.
rateFormTemplate.find('.dw-more-rat-tags').hide();
rateFormTemplate.find('.dw-show-more-rat-tags').show().
  click(function() {
    $(this).hide().
      closest('form').find('.dw-more-rat-tags').show();
  });

// ------- Replying

$('.debiki').delegate('.dw-reply', 'click', function() {
  // Warning: Some duplicated code, see .dw-rat-tag and dw-edit click() above.
  var $post;
  var postId = 'root'; // means is-reply-to-the-article-itself, TODO: 'A'
  var $thread = $(this).closest('.dw-cmt');
  if ($thread.length) {
    // Change postId to refer to the comment not the article.
    clearfix($thread); // ensures the reply appears nested inside the thread
    $post = $thread.children('.dw-cmt-wrap');
    if ($post.length)
      postId = $post.attr('id').substr(8, 999); // drop initial "dw-post-"
    else {
      // There's no parent post -- leave postId = 'root', which means
      // a reply to the article (e.g. blog post) itself.
    }
  }
  else {
    $thread = $(this).closest('.dw-debate');
  }
  var $replyForm = $('#dw-hidden-templates .dw-fs-re').clone(true);
  $replyForm.find("input[name='dw-fi-post']").attr('value', postId);
  syncUserName($replyForm);
  makeIdsUniqueUpdateLabels($replyForm, '-post-'+ postId);
  $replyForm.children('form').resizable({
      alsoResize: $replyForm.find('textarea'),
      resize: resizeRootThreadExtraWide, // TODO rm textarea width?
      stop: resizeRootThreadNowAndLater
    });
  //
  // Ajax-post reply on submit.
  //  - Disable form until request completed.
  //  - When completed, insert the new reply, highlighted.
  $replyForm.submit(function(){
    $.post(Settings.makeReplyUrl(debateId, postId),
        $replyForm.children('form').serialize(), function(newDebateHtml){
      updateDebate(newDebateHtml);
      slideAwayRemove($replyForm);
    }, 'html');
    $replyForm.find('input').dw_disable();
    return false;
  });
  //
  // Fancy fancy
  $replyForm.find('.dw-submit-set input').button();
  $replyForm.find('label').addClass( // color and font matching <input> buttons
    'dw-color-from-ui-state-default dw-font-from-ui-widget');
  // Reveal the form
  slideInActionForm($replyForm, $thread);
  dismissActionMenu();
});

// ------- Editing

$('.debiki').delegate('.dw-edit', 'click', function() {
  // Warning: Some duplicated code, see .dw-rat-tag and .dw-reply click() above.
  var $thread = $(this).closest('.dw-cmt');
  clearfix($thread); // makes edit area appear inside $thread
  var $post = $thread.children('.dw-cmt-wrap');
  // Create a div into which to load the edit <form>s -- the div class should
  // match the edit form div's class, so the action-menu won't be displayed
  // again until the request has completed and the edit form has been closed.
  var $formWrap = $("<div class='dw-fs'></div>").insertAfter(
      $thread.children('.dw-act:last'));//TODO: use $.get & update() instead
  $formWrap.hide(); // slide in later
  var postId = $post.attr('id').substr(8, 999); // drop initial "dw-post-"
  dismissActionMenu();  // before ajax request, or 2 edit <forms> will
                        // appear if you double click.
  $formWrap.load(Settings.makeEditUrl(debateId, postId) + ' .dw-fs-ed',
      function(editFormHtml) {

    // (Need not make ids unique; the post id was known when html generated.)

    var $editDiv = $formWrap.find('.dw-fs-ed').hide(); // TODO? Remove `find'?
    var $accordions = $editDiv.find('.dw-edits');

    var $editsPendingForm = $editDiv.find('.dw-edits-others-form'); 
    var $editsYoursForm = $editDiv.find('.dw-new-edit-form'); 
    var $editsAppliedForm = $editDiv.find('.dw-edits-applied-form'); 

    var $showEditsPendingBtn = $editDiv.find('.dw-show-edits-pending-btn');
    var $showNewEditBtn = $editDiv.find('.dw-new-edit-btn');
    var $showEditsAppliedBtn = $editDiv.find('.dw-show-edits-applied-btn');

    var $forms = $editsPendingForm.add($editsYoursForm).add($editsAppliedForm);
    var $showBtns = $showEditsPendingBtn.add($showNewEditBtn).
                                                    add($showEditsAppliedBtn);
    $forms.addClass('ui-helper-clearfix');

    // If there are any edits suggested, show them (or people will
    // never understand they're supposed to vote them up/down).
    // Otherwise, show the new-edit-suggestion form.
    if ($editsPendingForm.length) $editsYoursForm.hide();
    else $showNewEditBtn.hide();
    $editsAppliedForm.hide();

    // Unwrap, since the form must be a thread child (not grandchild)
    // or the action menu will appear if hovering the post.
    $editDiv.unwrap();

    // Copy post text to edit-suggestion textarea.
    var curText = '';
    $post.find('.dw-cmt-bdy p').each(function(){
          curText += $(this).text() + '\n\n'; });
    $editsYoursForm.find('textarea').val(curText.trim() + '\n');

    syncUserName($editsYoursForm);

    // Make forms and accordions resizable
    $editsYoursForm.resizable({
        alsoResize: $editsYoursForm.find('textarea')
        // (Need not resizeRootThread,
        // since the $editDiv is not resized.)
      });
    $accordions.wrap("<div class='dw-resize-accordion' />");
    $accordions.each(function(){
      var $this = $(this);
      var $accwrap = $this.parent();
      $this.closest('form').resizable({
          alsoResize: $accwrap,
          resize: function(){ $this.accordion("resize"); },
          // (Need not resizeRootThread,
          // since the $editDiv is not resized.)
          minHeight: 100
        });
    });

    // Adjust dimensions.
    var width = Math.min(400, $post.outerWidth()); // root post very wide
    width = Math.max(250, width); // deeply nested posts too thin
    $editDiv.css('width', '' + width + 'px');
    $accordions.parent().css('height', '300px');

    $showEditsPendingBtn.button().hide().click(function(){
      $(this).slideUp();
      $editsPendingForm.slideDown();
      $accordions.accordion("resize"); // new element was made visible
    });

    $showNewEditBtn.button().click(function(){
      $(this).slideUp();
      $editsYoursForm.slideDown();
    });

    $showEditsAppliedBtn.button().click(function(){
      $(this).slideUp();
      $editsAppliedForm.slideDown();
      $accordions.accordion("resize");
    });

    // Close forms, and show open-form buttons, on Cancel click.
    // Remove the whole edit <div> if all forms are closed (not visible).
    $forms.each(function(ix){
      $(this).find('.dw-cancel').click(function(){
        $showBtns.slice(ix,ix+1).slideDown();
        $(this).closest('form').slideUp().queue(function(next){
            if ($editsPendingForm.is(':visible') +
                $editsYoursForm.is(':visible') +
                $editsAppliedForm.is(':visible') == 0)
              slideAwayRemove($editDiv);
            next();
          });
      });
    });

    // Fancy fancy
    $editDiv.find(
        "input[type='button'], input[type='submit'], input[type='radio']").
        button();
    $editDiv.find('label').addClass(
      // color and font matching <input> buttons
      'dw-color-from-ui-state-default dw-font-from-ui-widget');

    // Reveal the form.
    // Must be done before accordion() is invoked (below) otherwise
    // jQuery UI (as of 1.8.2) will make it very small.
    slideInActionForm($editDiv);

    // Cannot use autoHeight, since other people's edit suggestions
    // might be arbitrary long?
    $accordions.each(function(){
        var numElems = $(this).find('h4').length;
        $(this).accordion(
        { collapsible: true, active: (numElems == 1 ? 0 : false),
          autoHeight: false, fillSpace: true, icons: false });
      });
  });
});

// ------- Miscellaneous

// Applies the clearfix fix to `thread' iff it has no child threads.
function clearfix(thread) {
  if (!thread.find(':has(.dw-cmt)').length) {
    thread.addClass('ui-helper-clearfix');
  }
}

// Finds all tags with an id attribute, and (hopefully) makes
// the ids unique by appending `suffix' to the ids.
// Updates any <label> `for' attributes to match the new ids.
function makeIdsUniqueUpdateLabels(jqueryObj, suffix) {
  jqueryObj.find("*[id]").each(function(ix) {
      $(this).attr('id', $(this).attr('id') + suffix);
    });
  jqueryObj.find('label').each(function(ix) {
      $(this).attr('for', $(this).attr('for') + suffix);
    });
}

function buildTagFind(html, selector) {
  if (selector.indexOf('#') != -1) throw Error('Cannot lookup by ID: '+
      'getElementById might return false, so use buildTagFindId instead');
  // From jQuery 1.4.2, jQuery.fn.load():
  var $wrap =
      // Create a dummy div to hold the results
      jQuery('<div />')
      // inject the contents of the document in, removing the scripts
      // to avoid any 'Permission Denied' errors in IE
      .append(html.replace(/<script(.|\s)*?\/script>/gi, ''));
  var $tag = $wrap.find(selector);
  return $tag;
}

// Builds HTML tags from `html' and returns the tag with the specified id.
// Works also when $.find('#id') won't (because of corrupt XML?).
function buildTagFindId(html, id) {
  if (id.indexOf('#') != -1) throw Error('Include no # in id');
  var $tag = buildTagFind(html, '[id="'+ id +'"]');
  return $tag;
}

// Highlight the parent post when hovering over a reference.
$(".dw-parent-ref").hover(
  function(event){
    $(this).closest(".dw-cmt").parent().closest(".dw-cmt").
            children(".dw-cmt-wrap").addClass("dw-highlight");
  },
  function(event){
    $(this).closest(".dw-cmt").parent().closest(".dw-cmt").
            children(".dw-cmt-wrap").removeClass("dw-highlight");
  });

// ------- Layout

resizeRootThread();

//----------------------------------------
   }); // end jQuery onload
//----------------------------------------

//========================================
   })(); // end Debiki module
//========================================






