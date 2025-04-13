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

        reviewsToDisplay.forEach(review => {
            const formattedDate = review.createdAt ? moment(review.createdAt).format("MMM D, YYYY") : 'Recently';
            const reviewerName = review.name ? escapeHtml(review.name) : 'Anonymous';
            const reviewText = review.text ? `<p class="text-neutral-light/80 mb-3">${escapeHtml(review.text)}</p>` : '<p class="text-neutral-light/50 italic mb-3">No comment left.</p>';

            const reviewHtml = `
                <article class="bg-neutral-darker p-6 rounded-lg shadow-lg border border-neutral-dark animate-fadeIn" style="opacity:1;"> <!-- Start visible -->
                    <div class="flex flex-col sm:flex-row justify-between sm:items-center mb-2 gap-2 sm:gap-4">
                        <h3 class="text-lg font-semibold text-white order-2 sm:order-1">${reviewerName}</h3>
                        <div class="order-1 sm:order-2">
                            ${renderStars(review.stars)}
                        </div>
                    </div>
                    ${reviewText}
                    <p class="text-xs text-neutral-light/60 text-right">Reviewed: ${formattedDate}</p>
                </article>
            `;
            $reviewsList.append(reviewHtml);
        });

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