$(document).ready(function() {
    // --- Calendar Initialization ---
    const today = moment().format('YYYY-MM-DD');
    const maxDate = moment().add(3, 'months').format('YYYY-MM-DD'); // Allow booking 3 months ahead

    $('#calendar').fullCalendar({
        header: {
            left: 'prev', // 'prev,next today'
            center: 'title',
            right: 'next' // 'month,agendaWeek,agendaDay' -> simplified view
        },
        defaultDate: today,
        navLinks: false, // Simplifies interaction, date selection handled below
        editable: false,
        eventLimit: true, // Limit the number of events displayed per day
        selectable: true,
        selectHelper: true,
        validRange: {
           start: today,
           end: maxDate
        },
        dayClick: function(date, jsEvent, view) {
            // Automatically fill the date form field when a day is clicked
             if (date.isBefore(moment().startOf('day'))) {
                // Prevent selecting past dates via click if validRange isn't enough
                return;
             }
            const selectedDate = date.format('YYYY-MM-DD');
            $('#date').val(selectedDate).trigger('change'); // Set value and trigger change event if needed

             // Optionally, scroll to the form
            $('html, body').animate({
                scrollTop: $("#reservationForm").offset().top - 100 // Adjust offset as needed (for fixed nav)
            }, 500);

             // Visually highlight selected day (optional, FC does some basic)
            $('.fc-day').removeClass('fc-day-selected-highlight'); // Remove previous highlight
             $(this).addClass('fc-day-selected-highlight'); // Add class for CSS styling (e.g., background color)
        },
        events: [
             // Example Events (could be dynamically loaded later based on real availability)
             // { title: 'Few Spots Left', start: moment().add(1, 'days').format('YYYY-MM-DD'), color: '#fcd34d', textColor: '#111827' },
            // { title: 'Likely Full', start: moment().add(5, 'days').format('YYYY-MM-DD'), color: '#f87171', textColor: '#ffffff', },
            // { title: 'Event Night', start: moment().add(10, 'days').format('YYYY-MM-DD'), backgroundColor: '#8b5cf6', borderColor:'#8b5cf6', textColor:'#fff'}
         ],
         eventRender: function(event, element) {
             // Add tooltips or popovers if desired
            element.attr('title', event.title);
        }
        // Future improvement: Fetch actual busy times via AJAX ('events' as a function)
    });

     // Set min attribute for date input
    $('#date').attr('min', today);

    // --- Form Submission Logic ---
    $('#reservationForm').submit(function (e) {
        e.preventDefault(); // Prevent default browser submission

        const form = $(this);
        const messageDiv = $('#reservationMessage');
        const submitButton = $('#submitButton');
        const buttonText = $('#buttonText');
        const buttonSpinner = $('#buttonSpinner');

        // Clear previous messages and show spinner
        messageDiv.html('').removeClass('text-green-400 text-red-400');
        buttonText.text('Sending Request...');
        buttonSpinner.removeClass('hidden');
        submitButton.prop('disabled', true).addClass('opacity-75 cursor-not-allowed');

        const formData = {
            name: $('#name').val(),
            email: $('#email').val(),
            numberOfPeople: $('#numberOfPeople').val(),
            date: $('#date').val(),
            time: $('#time').val(),
            specialRequests: $('#specialRequests').val() || '', // Include optional field
        };

         console.log("Submitting data:", formData); // Log data being sent

        // --- Using Fetch API (Modern Alternative to $.ajax) ---
         fetch('/reserve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                 // Add any other headers if needed (e.g., CSRF token)
            },
            body: JSON.stringify(formData) // Convert JS object to JSON string
        })
        .then(response => {
            // Check if response status is ok (200-299)
            if (!response.ok) {
                // If not ok, parse the JSON error body and throw it to be caught below
                return response.json().then(err => { throw err; });
             }
             // If ok, parse the JSON success body
            return response.json();
        })
        .then(data => {
            // --- Success Handling ---
            console.log('Success Response:', data);
            messageDiv.html(`
                <div class="p-4 bg-green-600/20 border border-green-500 rounded-lg text-green-300">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                    ${data.message || 'Request sent! Please check your email to verify.'}
                 </div>
            `);
             form[0].reset(); // Reset the form fields

             // Re-enable button after a short delay (or immediately)
            setTimeout(() => {
                 buttonText.text('Request Reservation');
                 buttonSpinner.addClass('hidden');
                submitButton.prop('disabled', false).removeClass('opacity-75 cursor-not-allowed');
            }, 1000);

             // Optional: Add event to calendar indicating pending verification (more complex)
         })
        .catch(error => {
            // --- Error Handling ---
             console.error('Error during fetch:', error);
             let errorMessage = "An unexpected error occurred. Please try again.";
            if (error && error.error) {
                // Use the specific error message from the server response if available
                errorMessage = error.error;
            } else if (error && typeof error === 'string') {
                errorMessage = error;
            }

             messageDiv.html(`
                <div class="p-4 bg-red-600/20 border border-red-500 rounded-lg text-red-300">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
                     ${errorMessage}
                </div>
             `);

             // Re-enable button
             buttonText.text('Request Reservation');
             buttonSpinner.addClass('hidden');
            submitButton.prop('disabled', false).removeClass('opacity-75 cursor-not-allowed');
         });

    }); // End of form submit handler

     // Optional: Style selected date visually
    $('head').append('<style>.fc-day-selected-highlight { background-color: rgba(16, 185, 129, 0.2) !important; }</style>');


}); // End of document ready
