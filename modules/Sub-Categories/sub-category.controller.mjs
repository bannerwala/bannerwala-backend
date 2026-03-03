import Category from '../Categories/Category.mjs';
import SubCategory from './SubCategory.mjs';
// Get all subcategories
export const getAllSubcategories = async (req, res) => {
    try {
        const subCategoryName = req.query.subCategoryName;
        const categoryName = req.query.categoryName;

        let filter = {};

        // Step 1: If category name is provided, find category's ObjectId
        if (categoryName) {
            const categoryFromDb = await Category.findOne({ name: { $regex: categoryName, $options: 'i' } });
            if (!categoryFromDb) {
                return res.status(404).json({ message: 'Category not found' });
            }
            filter.category = categoryFromDb._id;
        }

        // Step 2: If subCategory name is provided, add to filter
        if (subCategoryName) {
            filter.name = { $regex: subCategoryName, $options: 'i' }; // case-insensitive match
        }

        let subCategories = await SubCategory.find(filter).populate('category');
        console.log(subCategories);

        res.json(subCategories);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
}

// Create a new subCategory
export const addSubCategory = async (req, res) => {
    try {
        const { name, category } = req.body;

        // 🔹 Validate name
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Name is required" });
        }

        // 🔹 Validate category string
        if (!category) {
            return res.status(400).json({ error: "Category is required" });
        }

        const cleanedName = name.trim();

        // Convert comma separated string to array
        const categoryNames = category
            .split(",")
            .map(c => c.trim())
            .filter(Boolean);

        if (!categoryNames.length) {
            return res.status(400).json({ error: "At least one valid category is required" });
        }

        // 🔹 Find categories (case-insensitive exact match)
        const categoryDocs = await Category.find({
            name: { $in: categoryNames.map(n => new RegExp(`^${n}$`, "i")) }
        });

        if (!categoryDocs.length) {
            return res.status(404).json({ error: "No matching categories found" });
        }

        const categoryIds = categoryDocs.map(cat => cat._id);

        // 🔹 Prevent duplicate subcategory name
        const existingSubCategory = await SubCategory.findOne({
            name: { $regex: `^${cleanedName}$`, $options: "i" }
        });

        if (existingSubCategory) {
            return res.status(400).json({ error: "SubCategory already exists" });
        }

        const subCategory = new SubCategory({
            name: cleanedName,
            category: categoryIds
        });

        await subCategory.save();

        return res.status(201).json(
            await subCategory.populate("category")
        );

    } catch (err) {
        console.error("Error creating subcategory:", err);
        return res.status(500).json({ error: err.message });
    }
};

// Get a single subCategory
export const getSingleSubCategory = async (req, res) => {
    try {
        const subCategory = await SubCategory.findById(req.params.id).populate('category');
        if (!subCategory) {
            return res.status(404).json({ error: 'SubCategory not found' });
        }
        res.json(subCategory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// Update a single subcategory
export const UpdateSingleSubcategory = async (req, res) => {
    const { name, category } = req.body;

    try {
        // 🔹 Validate name
        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Name is required" });
        }

        // 🔹 Validate category
        if (!category) {
            return res.status(400).json({ error: "Category is required" });
        }

        const cleanedName = name.trim();

        // Convert comma separated string to array
        const categoryNames = category
            .split(",")
            .map(c => c.trim())
            .filter(Boolean);

        if (!categoryNames.length) {
            return res.status(400).json({ error: "At least one valid category is required" });
        }

        // Find matching categories (case-insensitive exact match)
        const categoryDocs = await Category.find({
            name: { $in: categoryNames.map(n => new RegExp(`^${n}$`, "i")) }
        });

        if (!categoryDocs.length) {
            return res.status(404).json({ error: "No matching categories found" });
        }

        const categoryIds = categoryDocs.map(cat => cat._id);

        // 🔹 Optional: Prevent duplicate subcategory name
        const existingSubCategory = await SubCategory.findOne({
            name: { $regex: `^${cleanedName}$`, $options: "i" },
            _id: { $ne: req.params.id } // exclude current one
        });

        if (existingSubCategory) {
            return res.status(400).json({ error: "SubCategory name already exists" });
        }

        const subCategory = await SubCategory.findByIdAndUpdate(
            req.params.id,
            {
                name: cleanedName,
                category: categoryIds
            },
            { new: true }
        ).populate("category");

        if (!subCategory) {
            return res.status(404).json({ error: "SubCategory not found" });
        }

        return res.json(subCategory);

    } catch (err) {
        console.error("Error updating subcategory:", err);
        return res.status(500).json({ error: err.message });
    }
};

