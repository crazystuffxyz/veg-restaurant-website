$(document).ready(function() {
    // --- Global Variables & References ---
    const today = moment().format('YYYY-MM-DD');
    const maxDate = moment().add(3, 'months').format('YYYY-MM-DD'); // Allow booking 3 months ahead
    const $dateInput = $('#date');
    const $partySizeSelect = $('#numberOfPeople');
    const $timeSelect = $('#time');
    const $timeLoader = $('#time-loader');
    const $reservationForm = $('#reservationForm');
    const $messageDiv = $('#reservationMessage');
    const $submitButton = $('#submitButton');
    const $buttonText = $('#buttonText');
    const $buttonSpinner = $('#buttonSpinner');

    // --- Calendar Initialization ---
    $('#calendar').fullCalendar({
        header: {
            left: 'prev',
            center: 'title',
            right: 'next'
        },
        defaultDate: today,
        navLinks: false,
        editable: false,
        eventLimit: true,
        selectable: true,
        selectHelper: true,
        validRange: {
           start: today,
           end: maxDate
        },
        dayClick: function(date, jsEvent, view) {
             if (date.isBefore(moment().startOf('day'))) {
                return; // Prevent selecting past dates
             }
            const selectedDate = date.format('YYYY-MM-DD');
            $dateInput.val(selectedDate).trigger('change'); // Set value AND trigger change event

            // Scroll to form
            $('html, body').animate({
                scrollTop: $reservationForm.offset().top - 100 // Adjust offset for fixed nav
            }, 500);

            // Visually highlight selected day
            $('.fc-day').removeClass('fc-day-selected-highlight');
            $(this).addClass('fc-day-selected-highlight');
        },
        events: [
            // Example events (replace with dynamic fetching if needed)
        ],
        eventRender: function(event, element) {
            element.attr('title', event.title);
        }
    });

    // Set min attribute for date input
    $dateInput.attr('min', today);

    // --- Function to Fetch Available Times (SIMULATED) ---
    function fetchAvailableTimes(selectedDate, partySize) {
        if (!selectedDate || !partySize) {
            $timeSelect.html('<option value="" disabled selected>Select date & guests first</option>').prop('disabled', true);
            return;
        }

        console.log(`Fetching times for ${selectedDate}, party size ${partySize}`);
        $timeLoader.removeClass('hidden').addClass('flex'); // Show loader
        $timeSelect.html('<option value="" disabled selected>Loading times...</option>').prop('disabled', true); // Disable and show loading text
        $messageDiv.html(''); // Clear previous messages

        // !!! --- SIMULATION --- !!!
        // Replace this setTimeout with a real fetch/AJAX call to your backend API
        // Your backend should return a list of available time slots (e.g., ['17:00', '17:30', '19:00'])
        // based on the selectedDate and partySize.
        setTimeout(() => {
            // Example simulated times (make this dynamic based on your backend response)
            let availableTimes = [];
            const dayOfWeek = moment(selectedDate).day(); // 0 = Sunday, 6 = Saturday

            // Simulate fewer times for larger parties or specific days
            if (partySize <= 4) {
                availableTimes = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
            } else if (partySize <= 6) {
                availableTimes = ['17:00', '18:00', '19:00', '20:00', '21:00'];
            } else {
                availableTimes = ['18:00', '19:30']; // Very limited for large parties
            }
            // Simulate weekend difference (e.g., no early slots)
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                 availableTimes = availableTimes.filter(time => time >= '18:00');
            }

            // --- Update Time Select Dropdown ---
            $timeLoader.addClass('hidden').removeClass('flex'); // Hide loader
            $timeSelect.empty(); // Clear existing options

            if (availableTimes.length > 0) {
                $timeSelect.append('<option value="" disabled selected>Select a time</option>');
                availableTimes.forEach(timeValue => {
                    // Format time for display (e.g., 5:30 PM)
                    const displayTime = moment(timeValue, 'HH:mm').format('h:mm A');
                    $timeSelect.append(`<option value="${timeValue}">${displayTime}</option>`);
                });
                $timeSelect.prop('disabled', false); // Enable select
            } else {
                $timeSelect.append('<option value="" disabled selected>No times available</option>');
                $timeSelect.prop('disabled', true); // Keep disabled
                 $messageDiv.html('<span class="text-secondary-light text-xs">No available times found for this date/party size.</span>');
            }

        }, 1000); // Simulate 1 second network delay
        // !!! --- END SIMULATION --- !!!

        /* --- Example of REAL Fetch Call (replace simulation above) ---
        fetch(`/api/available-times?date=${selectedDate}&partySize=${partySize}`)
            .then(response => {
                $timeLoader.addClass('hidden').removeClass('flex'); // Hide loader
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(availableTimes => { // Assuming backend returns an array like ['17:00', '19:30']
                $timeSelect.empty();
                if (availableTimes && availableTimes.length > 0) {
                    $timeSelect.append('<option value="" disabled selected>Select a time</option>');
                    availableTimes.forEach(timeValue => {
                        const displayTime = moment(timeValue, 'HH:mm').format('h:mm A');
                        $timeSelect.append(`<option value="${timeValue}">${displayTime}</option>`);
                    });
                    $timeSelect.prop('disabled', false);
                } else {
                    $timeSelect.append('<option value="" disabled selected>No times available</option>');
                    $timeSelect.prop('disabled', true);
                    $messageDiv.html('<span class="text-secondary-light text-xs">No available times found for this date/party size.</span>');
                }
            })
            .catch(error => {
                console.error('Error fetching times:', error);
                $timeLoader.addClass('hidden').removeClass('flex');
                $timeSelect.empty().append('<option value="" disabled selected>Error loading times</option>').prop('disabled', true);
                $messageDiv.html('<span class="text-red-400 text-xs">Could not load times. Please try again.</span>');
            });
        */
    }

    // --- Event Listeners for Date and Party Size Changes ---
    $dateInput.add($partySizeSelect).on('change', function() {
        const selectedDate = $dateInput.val();
        const partySize = $partySizeSelect.val();

        // Update calendar highlight if date changed via input field
        if ($(this).is($dateInput) && selectedDate) {
             $('.fc-day').removeClass('fc-day-selected-highlight');
             // Find the date cell in FullCalendar and add highlight
             // Note: This selector might need adjustment based on FullCalendar's structure/updates
             $(`.fc-day[data-date="${selectedDate}"]`).addClass('fc-day-selected-highlight');
             // Optionally, make the calendar go to the selected date if it's not in the current view
             // $('#calendar').fullCalendar('gotoDate', selectedDate);
        }

        fetchAvailableTimes(selectedDate, partySize);
    });

    // --- Form Submission Logic ---
    $reservationForm.submit(function (e) {
        e.preventDefault(); // Prevent default browser submission

        // Basic Client-Side Validation (Example)
        let isValid = true;
        // Clear previous errors (if using error divs like #name-error)
        $('.text-red-400.text-xs').text(''); // Clear all error placeholders

        if (!$('#name').val()) { $('#name-error').text('Name is required.'); isValid = false; }
        if (!$('#email').val()) { $('#email-error').text('Email is required.'); isValid = false; }
        // Add more specific email validation if needed
        if (!$partySizeSelect.val()) { $('#people-error').text('Party size is required.'); isValid = false; }
        if (!$dateInput.val()) { $('#date-error').text('Date is required.'); isValid = false; }
        if (!$timeSelect.val() || $timeSelect.prop('disabled')) { // Check if time is selected and enabled
             $('#time-error').text('Please select an available time.'); isValid = false;
        }

        if (!isValid) {
            $messageDiv.html('<span class="text-red-400">Please correct the errors above.</span>');
            return; // Stop submission if validation fails
        }

        // --- Proceed with submission ---
        $messageDiv.html('').removeClass('text-green-400 text-red-400'); // Clear messages
        $buttonText.text('Sending Request...');
        $buttonSpinner.removeClass('hidden');
        $submitButton.prop('disabled', true).addClass('opacity-75 cursor-not-allowed');

        const formData = {
            name: $('#name').val(),
            email: $('#email').val(),
            numberOfPeople: $partySizeSelect.val(),
            date: $dateInput.val(),
            time: $timeSelect.val(), // Use the selected time value (e.g., "17:30")
            specialRequests: $('#specialRequests').val() || '',
        };

        console.log("Submitting data:", formData);

        // Using Fetch API to submit to backend endpoint '/reserve'
        fetch('/reserve', { // Ensure this endpoint exists on your server
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add CSRF token header if needed by your backend framework
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                // Try to parse error message from backend JSON response
                return response.json().then(err => { throw err; }).catch(() => {
                    // If parsing fails or no JSON body, throw generic error
                     throw new Error(`Server responded with status: ${response.status}`);
                });
            }
            return response.json(); // Parse success JSON
        })
        .then(data => {
            // --- Success Handling ---
            console.log('Success Response:', data);
            $messageDiv.html(`
                <div class="p-4 bg-green-600/20 border border-green-500 rounded-lg text-green-300">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                    ${data.message || 'Request sent! Please check your email to verify.'}
                 </div>
            `);
            $reservationForm[0].reset(); // Reset the form fields
            // Reset time select to initial state
            $timeSelect.html('<option value="" disabled selected>Select date & guests first</option>').prop('disabled', true);
            // Remove calendar highlight
            $('.fc-day').removeClass('fc-day-selected-highlight');

            // Re-enable button after a short delay
            setTimeout(() => {
                 $buttonText.text('Request Reservation');
                 $buttonSpinner.addClass('hidden');
                $submitButton.prop('disabled', false).removeClass('opacity-75 cursor-not-allowed');
            }, 1000);
         })
        .catch(error => {
            // --- Error Handling ---
            console.error('Error during fetch:', error);
            let errorMessage = "An unexpected error occurred. Please try again.";
            // Use specific error message from backend if available
            if (error && error.error) { errorMessage = error.error; }
            else if (error && error.message) { errorMessage = error.message; }
            else if (typeof error === 'string') { errorMessage = error; }

            $messageDiv.html(`
                <div class="p-4 bg-red-600/20 border border-red-500 rounded-lg text-red-300">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
                     ${errorMessage}
                </div>
             `);

             // Re-enable button
             $buttonText.text('Request Reservation');
             $buttonSpinner.addClass('hidden');
            $submitButton.prop('disabled', false).removeClass('opacity-75 cursor-not-allowed');
         });

    }); // End of form submit handler

    // Remove the inline style added previously, use the one in <style> tag in HTML head
    // $('head').append('<style>.fc-day-selected-highlight { background-color: rgba(16, 185, 129, 0.2) !important; }</style>');

}); // End of document ready
