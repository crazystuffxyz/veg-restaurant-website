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
    const restaurantPhoneNumber = '(703) 555-1234'; // Store phone number

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
        eventLimit: true, // If you were showing events
        selectable: true,
        selectHelper: true,
        validRange: {
           start: today,
           end: maxDate
        },
        dayRender: function (date, cell) {
            // Add past class to past days for styling
            if (date.isBefore(moment().startOf('day'))) {
                cell.addClass('fc-past');
            }
        },
        dayClick: function(date, jsEvent, view) {
             // Allow clicking today, prevent clicking past dates
             if (date.isBefore(moment().startOf('day'))) {
                return;
             }
            const selectedDate = date.format('YYYY-MM-DD');
            // Only update if the date is different
            if ($dateInput.val() !== selectedDate) {
                $dateInput.val(selectedDate).trigger('change'); // Set value AND trigger change event
            } else {
                 // If same date clicked, still visually highlight
                 $('.fc-day').removeClass('fc-day-selected-highlight');
                 $(this).addClass('fc-day-selected-highlight');
            }


            // Scroll to form if needed (optional)
             // $('html, body').animate({
             //     scrollTop: $reservationForm.offset().top - 100 // Adjust offset for fixed nav
             // }, 500);

        },
        // events: [] // Keep empty unless you plan to show booked blocks on calendar
    });

    // Set min/max attributes for date input
    $dateInput.attr('min', today);
    $dateInput.attr('value', today);
    $dateInput.attr('max', maxDate);

    // --- Function to Fetch Available Times (REAL) ---
    function fetchAvailableTimes(selectedDate, partySize) {
        // Reset time select and message div
        $timeSelect.html('<option value="" disabled selected>Select date & guests first</option>').prop('disabled', true);
        $messageDiv.html(''); // Clear previous user messages

        if (!selectedDate || !partySize) {
            return; // Exit if date or party size is missing
        }

        console.log(`Fetching times for ${selectedDate}, party size ${partySize}`);
        $timeLoader.removeClass('hidden').addClass('flex'); // Show loader
        $timeSelect.prop('disabled', true); // Keep disabled during load

        // --- Fetch call to the new backend endpoint ---
        fetch(`/availability?date=${selectedDate}&partySize=${partySize}`)
            .then(response => {
                $timeLoader.addClass('hidden').removeClass('flex'); // Hide loader regardless of outcome
                if (!response.ok) {
                    // Try parsing error from backend JSON first
                    return response.json().then(errData => {
                        throw new Error(errData.error || `Server error: ${response.status}`);
                    }).catch(() => {
                        // If no JSON error body, throw generic HTTP error
                        throw new Error(`Network response was not ok: ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => { // Expecting { date, requestedPartySize, capacityLimit, slots: [...] }
                console.log("Availability data received:", data);
                populateTimeSlots(data.slots, partySize); // Pass slots array and requested size
            })
            .catch(error => {
                console.error('Error fetching times:', error);
                $timeSelect.empty().append('<option value="" disabled selected>Error loading times</option>').prop('disabled', true);
                $messageDiv.html(`<span class="text-red-400 text-sm">Could not load times: ${error.message}. Please try again or call us.</span>`);
            });
    }

    // --- Function to Populate Time Slot Dropdown ---
    function populateTimeSlots(slots, requestedPartySize) {
        $timeSelect.empty(); // Clear previous options
        let availableSlotsFound = false;

        if (!slots || slots.length === 0) {
             $timeSelect.append('<option value="" disabled selected>No times available</option>');
             $messageDiv.html(`<span class="text-secondary-light text-sm">Sorry, no online reservations are available for ${requestedPartySize} guest(s) on this date. Please try another date or call us at <a href="tel:${restaurantPhoneNumber}" class="underline hover:text-primary">${restaurantPhoneNumber}</a>.</span>`);
             $timeSelect.prop('disabled', true);
             return;
        }

        // Add the default placeholder option first
        $timeSelect.append('<option value="" disabled selected>Select an available time</option>');

        slots.forEach(slot => {
            const option = $('<option></option>');
            option.val(slot.time); // e.g., "17:30"

            let displayText = slot.displayTime; // e.g., "5:30 PM"
            let isAvailable = false;

            switch(slot.status) {
                case 'available':
                    isAvailable = true;
                    availableSlotsFound = true;
                    // Optionally show seats left: displayText += ` (${slot.availableSeats} seats)`;
                    break;
                case 'limited':
                    displayText += ` (Only ${slot.availableSeats} seat${slot.availableSeats > 1 ? 's' : ''} left)`;
                    option.prop('disabled', true).addClass('unavailable'); // Mark as unavailable for selection
                    break;
                case 'full':
                    displayText += ' (Booked)';
                    option.prop('disabled', true).addClass('unavailable');
                    break;
                case 'past':
                     displayText += ' (Past)';
                     option.prop('disabled', true).addClass('unavailable');
                     break;
                default: // 'unknown' or other cases
                     displayText += ' (Unavailable)';
                     option.prop('disabled', true).addClass('unavailable');
            }

            option.text(displayText);
            $timeSelect.append(option);
        });

        // Final check: if no slots were actually marked as 'available'
        if (!availableSlotsFound) {
             $timeSelect.find('option:not([disabled])').remove(); // Remove the "Select..." placeholder
             $timeSelect.prepend('<option value="" disabled selected>No suitable times available</option>'); // Add specific message
             $messageDiv.html(`<span class="text-secondary-light text-sm">Sorry, we don't have availability for ${requestedPartySize} guest(s) at any time on this date. Please try another date or call us at <a href="tel:${restaurantPhoneNumber}" class="underline hover:text-primary">${restaurantPhoneNumber}</a>.</span>`);
             $timeSelect.prop('disabled', true);
        } else {
             $timeSelect.prop('disabled', false); // Enable the select dropdown
             // Optional: Add message about tables left for the day (requires backend logic)
             // $messageDiv.html('<span class="text-green-300 text-sm">Select your preferred time below.</span>');
        }
    }


    // --- Event Listeners for Date and Party Size Changes ---
    $dateInput.add($partySizeSelect).on('change', function() {
        const selectedDate = $dateInput.val();
        const partySize = $partySizeSelect.val();

        // Update calendar highlight if date changed via input field or calendar click handled it
        if (selectedDate) {
             $('.fc-day').removeClass('fc-day-selected-highlight');
             // Note: Selector finds the cell by data-date attribute
             $(`.fc-day[data-date="${selectedDate}"]`).addClass('fc-day-selected-highlight');

             // Optionally, ensure the calendar view shows the selected date
             // $('#calendar').fullCalendar('gotoDate', selectedDate);
        }

        fetchAvailableTimes(selectedDate, partySize);
    });

    // --- Form Submission Logic (Mostly Unchanged) ---
    $reservationForm.submit(function (e) {
        e.preventDefault(); // Prevent default browser submission

        // Client-Side Validation
        let isValid = true;
        $('.text-red-400.text-xs').text(''); // Clear previous errors
        $messageDiv.html(''); // Clear general messages

        if (!$('#name').val()) { $('#name-error').text('Name is required.'); isValid = false; }
        if (!$('#email').val() || !/^\S+@\S+\.\S+$/.test($('#email').val())) { // Basic email format check
            $('#email-error').text('Valid email is required.'); isValid = false;
        }
        if (!$partySizeSelect.val()) { $('#people-error').text('Party size is required.'); isValid = false; }
        if (!$dateInput.val()) { $('#date-error').text('Date is required.'); isValid = false; }
        // Check if time is selected AND the selected option is not disabled
        if (!$timeSelect.val() || $timeSelect.find('option:selected').prop('disabled')) {
             $('#time-error').text('Please select an available time slot.'); isValid = false;
        }

        if (!isValid) {
            $messageDiv.html('<span class="text-red-400 text-sm">Please correct the errors above.</span>');
            // Focus first invalid field (optional enhancement)
            $('.text-red-400.text-xs').not(':empty').first().prev('input, select, textarea').focus();
            return;
        }

        // --- Proceed with submission ---
        $messageDiv.html(''); // Clear messages
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

        // Fetch API to submit to backend endpoint '/reserve' (Keep as is)
        fetch('/reserve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                 return response.json().then(err => { throw err; }).catch(() => {
                     throw new Error(`Server responded with status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            // --- Success Handling ---
            console.log('Success Response:', data);
            $messageDiv.html(`
                <div class="p-4 bg-green-600/20 border border-green-500 rounded-lg text-green-300 text-sm">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                    ${data.message || 'Request sent! Please check your email to verify.'}
                 </div>
            `);
            $reservationForm[0].reset();
            // Reset time select and message
            $timeSelect.html('<option value="" disabled selected>Select date & guests first</option>').prop('disabled', true);
             $messageDiv.append('<div class="mt-2 text-xs text-neutral-light/70">Form reset. Select details for a new reservation.</div>'); // Add confirmation of reset
            $('.fc-day').removeClass('fc-day-selected-highlight'); // Remove calendar highlight

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
            if (error && error.error) { errorMessage = error.error; }
            else if (error && error.message) { errorMessage = error.message; }
            else if (typeof error === 'string') { errorMessage = error; }

            $messageDiv.html(`
                <div class="p-4 bg-red-600/20 border border-red-500 rounded-lg text-red-300 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline -mt-1 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
                     Reservation failed: ${errorMessage}
                </div>
             `);

             // Re-enable button
             $buttonText.text('Request Reservation');
             $buttonSpinner.addClass('hidden');
            $submitButton.prop('disabled', false).removeClass('opacity-75 cursor-not-allowed');
         });

    }); // End of form submit handler

}); // End of document ready