import TemplateActivity from "../TemplatesActivity/TemplatesActivity.mjs";

export const templateAction = async (req, res) => {
  try {
    const { userId, templateId, action } = req.body;

    await TemplateActivity.create({
      user: userId,
      template: templateId,
      action: action
    });

    if (action === "download") {
      res.json({ message: `Download recorded successfully` });
    } else if (action === "share") {
      res.json({ message: `Shared recorded successfully` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// export const getTemplatesActivityCount = async (req, res) => {
//   try {
//     const { userId, templateId, action } = req.query;

//     const templateActivities = await TemplateActivity.find({ userId, templateId, action })
//       .populate('user')
//       .populate('template');
//     res.json(templateActivities);


//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// }