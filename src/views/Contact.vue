<template>
  <v-container>
    <h2 class="text-center my-6">Get in Touch</h2>
    <v-form ref="form" v-model="valid">
      <v-text-field
        v-model="name"
        :rules="nameRules"
        label="Name"
        required
      />
      <v-text-field
        v-model="email"
        :rules="emailRules"
        label="Email"
        required
      />
      <v-textarea
        v-model="message"
        :rules="messageRules"
        label="Message"
        required
      />
      <v-btn color="green darken-1" class="mt-4" @click="submit">
        Send Message
      </v-btn>
    </v-form>
  </v-container>
</template>

<script>
import axios from 'axios'
export default {
  name: "Contact",
  metaInfo: {
    title: 'Green Bites - Contact'
  },
  data() {
    return {
      valid: false,
      name: '',
      email: '',
      message: '',
      nameRules: [v => !!v || 'Name is required'],
      emailRules: [
        v => !!v || 'E-mail is required',
        v => /.+@.+\..+/.test(v) || 'E-mail must be valid'
      ],
      messageRules: [v => !!v || 'Message is required']
    }
  },
  methods: {
    async submit() {
      if (this.$refs.form.validate()) {
        // API to contact... maybe an email api is needed.
        try {
          await axios.post('/api/contact', {
            name: this.name,
            email: this.email,
            message: this.message
          })
          alert('Message sent successfully!')
        } catch (error) {
          alert('There was an error sending your message. Please try again.')
          console.error(error)
        }
      }
    }
  }
}
</script>
