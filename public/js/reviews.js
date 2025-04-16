$(document).ready(function() {
    // --- Configuration ---
    const REVIEWS_PER_PAGE = 5; // Max reviews per page

    // --- References ---
    const $reviewsList = $('#reviewsList');
    const $loadingReviews = $('#loadingReviews');
    const $reviewForm = $('#reviewForm');
    const $reviewMessage = $('#reviewMessage');
    const $submitButton = $('#submitReviewButton');
    const $buttonText = $('#reviewButtonText');
    const $buttonSpinner = $('#reviewButtonSpinner');
    const $ratingError = $('#rating-error');
    const $paginationControls = $('#paginationControls');
    const $prevPageButton = $('#prevPageButton');
    const $nextPageButton = $('#nextPageButton');
    const $pageInfo = $('#pageInfo');

    // --- State Variables ---
    let allReviews = []; // To store all fetched reviews
    let currentPage = 1;
    let totalPages = 1;

    // --- Helper: Render Stars ---
    function renderStars(rating) {
        let starsHtml = '';
        const filledStar = '★';
        const emptyStar = '<span class="empty-star">★</span>';
        for (let i = 1; i <= 5; i++) {
            starsHtml += (i <= rating) ? filledStar : emptyStar;
        }
        return `<div class="display-stars text-xl" aria-label="${rating} out of 5 stars">${starsHtml}</div>`;
    }

    // --- Helper: Escape HTML ---
    function escapeHtml(unsafe) {
        if (!unsafe) return "";
        return unsafe
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, "\"")
             .replace(/'/g, "'");
     }

     // --- Function to Render Reviews for the Current Page ---
     function renderCurrentPage() {
        $reviewsList.empty(); // Clear previous reviews
        $loadingReviews.hide(); // Ensure loading is hidden

        if (allReviews.length === 0) {
            $reviewsList.html('<p class="text-center text-neutral-light/70 py-8">Be the first to leave a review!</p>');
            $paginationControls.hide(); // Hide pagination if no reviews
            return;
        }

        totalPages = Math.ceil(allReviews.length / REVIEWS_PER_PAGE);
        // Ensure currentPage is valid
        if (currentPage < 1) currentPage = 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const startIndex = (currentPage - 1) * REVIEWS_PER_PAGE;
        const endIndex = startIndex + REVIEWS_PER_PAGE;
        const reviewsToDisplay = allReviews.slice(startIndex, endIndex);

        if (reviewsToDisplay.length === 0 && allReviews.length > 0) {
            // This case might happen if currentPage became invalid after deleting/filtering
            currentPage = 1; // Reset to first page
            renderCurrentPage(); // Re-render
            return;
        }

// Assuming escapeHtml is defined elsewhere if needed, but .text() handles escaping.
// function escapeHtml(unsafe) {
//     return unsafe
//          .replace(/&/g, "&")
//          .replace(/</g, "<")
//          .replace(/>/g, ">")
//          .replace(/"/g, """)
//          .replace(/'/g, "'");
// }

// Assuming renderStars is defined elsewhere and returns safe HTML
// function renderStars(count) { /* ... returns star HTML ... */ }

// Assuming $reviewsList is a jQuery object selecting the container
// const $reviewsList = $('#reviews-list'); // Example

reviewsToDisplay.forEach(review => {
    const formattedDate = review.createdAt ? moment(review.createdAt).format("MMM D, YYYY") : 'Recently';
    // Use .text() later, so no need to escape here if using jQuery's .text() or vanilla .textContent
    const reviewerName = review.name ? review.name : 'Anonymous';

    // 1. Create the main review element structure (using jQuery for convenience)
    //    Use placeholders or specific selectors for dynamic content.
    const reviewElement = $(`
        <article class="bg-neutral-darker p-6 rounded-lg shadow-lg border border-neutral-dark animate-fadeIn" style="opacity:1;">
            <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-2 gap-2 sm:gap-4">
                <h3 class="reviewer-name text-lg font-semibold text-white order-2 sm:order-1"></h3>
                <div class="review-stars order-1 sm:order-2">
                    ${renderStars(review.stars)}
                </div>
            </div>
            <p class="review-text mb-3"></p> <!-- Placeholder for review text -->
            <p class="review-date text-xs text-neutral-light/60 text-right"></p>
        </article>
    `);

    // 2. Safely populate the dynamic content using .text()

    // Set reviewer name
    reviewElement.find('.reviewer-name').text(reviewerName);

    // Find the review text paragraph
    const reviewTextParagraph = reviewElement.find('.review-text');

    // Set review text and apply conditional classes
    if (review.text) {
        reviewTextParagraph.text(review.text); // Use .text() for safety (sets innerText/textContent)
        reviewTextParagraph.removeClass('text-neutral-light/50 italic').addClass('text-neutral-light/80');
    } else {
        reviewTextParagraph.text('No comment left.'); // Set placeholder text
        reviewTextParagraph.removeClass('text-neutral-light/80').addClass('text-neutral-light/50 italic');
    }

    // Set formatted date
    reviewElement.find('.review-date').text(`Reviewed: ${formattedDate}`);

    // 3. Append the fully constructed and populated element to the list
    $reviewsList.append(reviewElement);
});

// --- Vanilla JS Alternative (if not using jQuery) ---
/*
reviewsToDisplay.forEach(review => {
    const formattedDate = review.createdAt ? moment(review.createdAt).format("MMM D, YYYY") : 'Recently';
    const reviewerName = review.name ? review.name : 'Anonymous';

    // 1. Create elements using document.createElement
    const article = document.createElement('article');
    article.className = 'bg-neutral-darker p-6 rounded-lg shadow-lg border border-neutral-dark animate-fadeIn';
    article.style.opacity = '1';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex flex-col sm:flex-row justify-between sm:items-center mb-2 gap-2 sm:gap-4';

    const nameH3 = document.createElement('h3');
    nameH3.className = 'text-lg font-semibold text-white order-2 sm:order-1';
    nameH3.textContent = reviewerName; // Use textContent for safety

    const starsDiv = document.createElement('div');
    starsDiv.className = 'order-1 sm:order-2';
    starsDiv.innerHTML = renderStars(review.stars); // Assuming renderStars returns safe HTML

    headerDiv.appendChild(nameH3);
    headerDiv.appendChild(starsDiv);

    const textP = document.createElement('p');
    textP.className = 'mb-3'; // Base class
    if (review.text) {
        textP.textContent = review.text; // Use textContent for safety
        textP.classList.add('text-neutral-light/80');
    } else {
        textP.textContent = 'No comment left.';
        textP.classList.add('text-neutral-light/50', 'italic');
    }

    const dateP = document.createElement('p');
    dateP.className = 'text-xs text-neutral-light/60 text-right';
    dateP.textContent = `Reviewed: ${formattedDate}`; // Use textContent for safety

    article.appendChild(headerDiv);
    article.appendChild(textP);
    article.appendChild(dateP);

    // Assuming reviewsList is a DOM element reference
    // const reviewsList = document.getElementById('reviews-list'); // Example
    reviewsList.appendChild(article);
});
*/

        updatePaginationControls();
     }

     // --- Function to Update Pagination Controls UI ---
     function updatePaginationControls() {
        if (totalPages <= 1) {
            $paginationControls.hide();
            return;
        }

        $pageInfo.text(`Page ${currentPage} of ${totalPages}`);
        $prevPageButton.prop('disabled', currentPage === 1);
        $nextPageButton.prop('disabled', currentPage === totalPages);
        $paginationControls.show();
     }


    // --- Function to Fetch All Reviews ---
    function fetchAllReviews() {
        $loadingReviews.show();
        $reviewsList.empty();
        $paginationControls.hide();

        fetch('/reviews')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(reviews => {
                allReviews = reviews; // Store all reviews globally
                currentPage = 1; // Reset to first page
                renderCurrentPage(); // Render the first page
            })
            .catch(error => {
                console.error('Error fetching reviews:', error);
                $loadingReviews.hide();
                $reviewsList.html('<p class="text-center text-red-400 py-8">Could not load reviews. Please try again later.</p>');
            });
    }

    // --- Event Listeners for Pagination ---
    $prevPageButton.on('click', function() {
        if (currentPage > 1) {
            currentPage--;
            renderCurrentPage();
            // Optional: Scroll to top of reviews list
            $('html, body').animate({ scrollTop: $reviewsList.offset().top - 100 }, 300);
        }
    });

    $nextPageButton.on('click', function() {
        if (currentPage < totalPages) {
            currentPage++;
            renderCurrentPage();
             // Optional: Scroll to top of reviews list
             $('html, body').animate({ scrollTop: $reviewsList.offset().top - 100 }, 300);
        }
    });


    // --- Form Submission Logic ---
    $reviewForm.submit(function(e) {
        e.preventDefault();
        $reviewMessage.html('').removeClass('text-green-400 text-red-400');
        $ratingError.text('');

        const name = $('#reviewerName').val().trim();
        const stars = $('input[name="rating"]:checked').val();
        const text = $('#reviewText').val().trim();

        if (!stars) {
            $ratingError.text('Please select a star rating.');
            $reviewMessage.html('<span class="text-red-400">Please correct the error above.</span>');
            $('html, body').animate({ scrollTop: $('.star-rating').offset().top - 150 }, 300);
            return;
        }

        $buttonText.text('Submitting...');
        $buttonSpinner.removeClass('hidden');
        $submitButton.prop('disabled', true).addClass('opacity-75 cursor-not-allowed');

        const reviewData = {
            name: name || null,
            stars: parseInt(stars, 10),
            text: text || null,
        };

        fetch('/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reviewData)
        })
        .then(response => response.json().then(data => ({ ok: response.ok, status: response.status, data })))
        .then(({ ok, status, data }) => {
             if (!ok) {
                 throw { status: status, message: data.error || `Server responded with status: ${status}` };
            }

            // --- Success Handling ---
            $reviewMessage.html(`
                <div class="p-3 bg-green-600/20 border border-green-500 rounded-lg text-green-300 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                    ${data.message || 'Review submitted successfully!'}
                </div>
            `);
            $reviewForm[0].reset();
            $('input[name="rating"]').prop('checked', false);

            // **Refresh the reviews and go to page 1 after submission**
            // Adding delay to allow user to see success message before list updates
            setTimeout(() => {
                 fetchAllReviews(); // This will refetch all and render page 1
            }, 1500);

            setTimeout(() => {
                 $buttonText.text('Submit Review');
                 $buttonSpinner.addClass('hidden');
                $submitButton.prop('disabled', false).removeClass('opacity-75 cursor-not-allowed');
            }, 1000); // Reset button slightly before potential list refresh

        })
        .catch(error => {
            // --- Error Handling ---
            console.error('Error submitting review:', error);
            let errorMessage = "An unexpected error occurred. Please try again.";
            if (error && error.message) { errorMessage = error.message; }

             $reviewMessage.html(`
                <div class="p-3 bg-red-600/20 border border-red-500 rounded-lg text-red-300 text-center">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
                     ${escapeHtml(errorMessage)}
                </div>
             `);

             $buttonText.text('Submit Review');
             $buttonSpinner.addClass('hidden');
            $submitButton.prop('disabled', false).removeClass('opacity-75 cursor-not-allowed');
        });
    });

    // --- Initial Load ---
    fetchAllReviews(); // Fetch all reviews on page load

}); // End of document ready
