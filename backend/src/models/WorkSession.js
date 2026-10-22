
const mongoose = require("mongoose");

const breakSchema = new mongoose.Schema(
  {
    startedAt: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const workSessionSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    breaks: {
      type: [breakSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["running", "on_break", "stopped"],
      default: "running",
      index: true,
    },

    totalWorkSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

workSessionSchema.index({
  employee: 1,
  project: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "WorkSession",
  workSessionSchema
);
                                                                                                                                                                         