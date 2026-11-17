/**
 * Public package boundary. Follow each export to its implementation and scenarios.
 * Views arrive from the application; user intents leave through an injected transport.
 */
export { validateStudyView } from "./validate_study_view.js";
export { renderStudy } from "./render_study.js";
export { createStudyController } from "./study_controller.js";
