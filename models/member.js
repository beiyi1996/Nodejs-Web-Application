const mongoose = require("mongoose");
let Schema = mongoose.Schema;

let memberSchema = new Schema({
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /([`~!@#$%^&*()_+}{":;'?\/\\>.<\[\],|])/.test(v);
      }
    }
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    validate: {
      validator: function(v) {
        return /\d{4}-\d{3}-\d{3}/.test(v);
      }
    }
  },
  gender: {
    type: Number,
    enum: [0, 1],
    default: 0
  },
  create_time: {
    type: Date,
    default: Date.now
  },
  modified_time: {
    type: Date,
    default: Date.now
  },
  token: {
    type: String,
    default: ""
  },
  create_token_time: {
    type: Date,
    default: ""
  }
});

module.exports = mongoose.model("Member", memberSchema);
