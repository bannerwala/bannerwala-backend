import moment from "moment";
import mongoose from "mongoose";


const subCategorySchema = new mongoose.Schema({
    name: String,
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    created_at: { type: Number, default: moment.utc().valueOf() },
    updated_at: { type: Number, default: moment.utc().valueOf() }
});


export default mongoose.model('SubCategory', subCategorySchema);
