import { useState, useEffect } from "react";
import { FormikProvider, useFormik } from "formik";
import { Observer } from "mobx-react";
import appointmentStore from "@/common/mobx/appointmentBooked";
import { LEAD_STAGES } from "@/common/constants/dummy";
import Questionnaire from "./Questionare";
import { getQuestionnaire } from "@/common/mobx/questionare";
import { getQuestionnaireSchema } from "./Validation";
import { useToastContext } from "@context/ToastContext";
import { useStores } from "../../common/mobx";
import { formatSlots } from "@/lib/utils";

import {
  createLeadPost,
  postQuestionnaire,
  fetchLeadInfoById,
  bookAppointmentNew,
} from "./leadSlice";
import ShowroomDetails from "./ShowroomDetails";
import App from "@/app/App";
import AppointmentSection from "./AppointmentSection";
import { is } from "date-fns/locale";
import { LeadStageEnum } from "@/lib/utils";
import { toJS } from "mobx";
import { QualifyLeadValidationPopUp } from "./leadInfo/Popups";

export default function BookAppointment({
  store,
  data,
  leadId,
  onStageChange,
}) {
  const [activeTab, setActiveTab] = useState("questionnaire");
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [isLoadingLeadInfo, setIsLoadingLeadInfo] = useState(true);
  const [savedAnswers, setSavedAnswers] = useState([]);
  const [savedData, setSavedData] = useState({});
  const [initialBookingValues, setInitialBookingValues] = useState({});
  const [completedTabs, setCompletedTabs] = useState(new Set());
  const [isSaved, setIsSaved] = useState(false);
  const [tabValidationStatus, setTabValidationStatus] = useState({
    questionnaire: false,
    book_appointment: false,
    details: false,
  });
  const [sortedSites, setSortedSites] = useState([]);
  const [showroomNotesModified, setShowroomNotesModified] = useState(false);
  const [slotBookingError, setSlotBookingError] = useState(null);

  const [showErrorPopup, setShowErrorPopup] = useState(false); // New state for error popup
  const [errorMessage, setErrorMessage] = useState(""); // New state for error message
  const pushToast = useToastContext();
  const get_Questionnaires = getQuestionnaire();
  // const near_distances = getNearestSiteDistances();
  const { LeadStore } = useStores();
  const isDisabled = true;
  const near_distances = LeadStore.leadSiteDistances;
  
  useEffect(() => {
    console.log(near_distances, "near_distances");
  }, [near_distances]);

  const validateRequiredFields = () => {
    const requiredFields = [];

    // Basic Details validation
    if (!data?.name) requiredFields.push("name");
    if (!data?.phone) requiredFields.push("phone");
    // if (!data?.email) requiredFields.push("email");
    if (!data?.address) requiredFields.push("address");

    // Lead Information validation
    if (!data?.zipcode) requiredFields.push("zipcode");
    if (!data?.language) requiredFields.push("language");
    if (!data?.nurse_id) requiredFields.push("lead_owner");
    if (!data?.status) requiredFields.push("status");

    // Update the MobX store with required fields
    LeadStore.setRequiredFields(requiredFields);

    return {
      isValid: requiredFields.length === 0,
      missingFields: requiredFields,
    };
  };

  useEffect(() => {
    const n_distances = toJS(near_distances);
    const sortedSites = n_distances?.site_info
      ? n_distances.site_info
          .map((site) => ({
            site_id: site.site_id,
            site_name: site.name,
            distance_km: site.distance_km || 0,
            zipcode: site.zipcode,
            location: site.location,
            coordinates: site.coordinates,
            country: site.country,
            coordinator: site.coordinator,
            phone: site.phone,
            logo: site.logo,
          }))
          .sort((a, b) => a.distance_km - b.distance_km)
      : [];
    setSortedSites(sortedSites);
    console.log(sortedSites, "sortedSitessortedSites");
  }, [near_distances]);

  useEffect(() => {
    if (!data?.stage) return;

    let newCompletedTabs = new Set();

    switch (data.stage) {
      case LeadStageEnum.LEAD:
        // No completed tabs for LEAD stage
        setActiveTab("questionnaire");
        newCompletedTabs = new Set();
        break;

      case LeadStageEnum.QUALIFY_LEAD:
        // Only questionnaire is completed
        setActiveTab("book_appointment");
        newCompletedTabs = new Set(["questionnaire"]);
        break;

      case LeadStageEnum.APPOINTMENT_BOOKED:
        setActiveTab("details");
        // Questionnaire and book_appointment are completed
        newCompletedTabs = new Set(["questionnaire", "book_appointment"]);
        break;

      case LeadStageEnum.VISITED:
        // All tabs are completed
        setActiveTab("details");
        newCompletedTabs = new Set([
          "questionnaire",
          "book_appointment",
          "details",
        ]);
        break;

      default:
        newCompletedTabs = new Set();
    }

    setCompletedTabs(newCompletedTabs);
  }, [data?.stage]);

  const tabs = [
    { id: "questionnaire", label: "Questionnaire" },
    { id: "book_appointment", label: "Book Appointment" },
    { id: "details", label: "Showroom Details" },
  ];

  const [isDirty, setIsDirty] = useState(false);

  const questionFieldMapV2 = (get_Questionnaires?.questions || []).reduce(
    (acc, question) => {
      acc[question.id] = `question_${question.id}`;
      return acc;
    },
    {}
  );
  const [selectedAvailableSlots, setSelectedAvailableSlots] = useState([]);

  useEffect(() => {
    const availableSlots = data?.available_slots
      ? formatSlots(JSON.parse(data.available_slots))
      : [];
    setSelectedAvailableSlots(availableSlots);
  }, [data?.available_slots]);

  const getInitialValues = (questions, data) => {
    const values = {};
    values.selectedSite = data?.site_id ? String(data.site_id) : "";
    values.appointmentDate = data?.appt_date || "";
    values.appointmentTime = data?.slot_time || "";
    values.showroomNotes = data?.showroomNotes || "";
    values.nextSteps = data?.nextSteps || "";
    values.zipcode = data?.zipcode || "";
    values.slotId = data?.slot_id || "";
    values.showroomNotes = data?.showroom_notes || "";
    values.nextSteps = data?.showroom_next_step || "";
    values.appointmentTimeString = `${data?.slot_time || "N/A"} - ${
      data?.slot_end_time || "N/A"
    }`;

    // Add new datetime fields
    values.start_datetime = data?.start_datetime || "";
    values.end_datetime = data?.end_datetime || "";
    values.appointmentEndTime = data?.slot_end_time || "";
    values.selectedAvailableSlots = data?.available_slots
      ? formatSlots(JSON.parse(data.available_slots))
      : [];
    return values;
  };

  useEffect(() => {
    // setSavedData({
    //   selectedSite: data?.site_id || "",
    //   appointmentDate: data?.appt_date || "",
    //   appointmentTime: data?.appt_tome || "",
    //   showroomNotes: data?.showroomNotes || "",
    //   slotId: data?.slot_id || "",
    // })

    // values.selectedSite = savedData.selectedSite || "";
    // values.appointmentDate = savedData.appointmentDate || "";
    // values.appointmentTime = savedData.appointmentTime || "";
    // values.showroomNotes = savedData.showroomNotes || "";
    // values.nextSteps = savedData.nextSteps || "";
    // values.zipcode = savedData.zipcode || "";
    // values.slotId = savedData.slotId || "";
    if (data) {
      const values = getInitialValues(
        get_Questionnaires?.questions || [],
        data
      );
      formik.setValues({ ...values, ...formik.values });
      // setInitialBookingValues(values);
    }
  }, [data]);

  useEffect(() => {
    if (selectedAvailableSlots.length > 0) {
      formik.setFieldValue("selectedAvailableSlots", selectedAvailableSlots);
    }
  }, [selectedAvailableSlots]);
  
  // Check if a tab is accessible (sequential flow logic)
  const isTabAccessible = (tabId) => {
    const leadStage = data?.stage;

    // If no lead stage, nothing is accessible
    if (!leadStage) return false;

    // For LEAD stage - only questionnaire is accessible
    if (leadStage === LeadStageEnum.LEAD) {
      return tabId === "questionnaire";
    }

    // For QUALIFY_LEAD stage - questionnaire and book_appointment are accessible, but NOT details
    if (leadStage === LeadStageEnum.QUALIFY_LEAD) {
      return tabId === "questionnaire" || tabId === "book_appointment";
    }

    // For APPOINTMENT_BOOKED stage - all tabs are accessible
    if (leadStage === LeadStageEnum.APPOINTMENT_BOOKED) {
      return true;
    }
    
    if (leadStage === LeadStageEnum.VISITED) {
      // If the lead has visited, all tabs are accessible
      return true;
    }

    // Default case - nothing accessible
    return false;
  };

  // Validate individual tabs
  const validateTab = (tabId, values) => {
    switch (tabId) {
      case "questionnaire":
        const requiredFields = (get_Questionnaires?.questions || [])
          .filter(
            (q) =>
              q.question_type === "boolean" ||
              q.question_type === "single_select" ||
              q.question_type === "multi_select"
          )
          .map((q) => questionFieldMapV2[q.id] || `question_${q.id}`);

        return requiredFields.every((field) => {
          const value = values[field];
          if (Array.isArray(value)) {
            return value.length > 0;
          }
          return !!value;
        });

      case "book_appointment":
        return !!(
          values.selectedSite &&
          values.appointmentDate &&
          values.start_datetime &&
          values.end_datetime
        );

      case "details":
        return true; // Details tab is always considered valid

      default:
        return false;
    }
  };
  
  const hasFormChangedFromSaved = () => {
    if (activeTab === "questionnaire") {
      const questions = get_Questionnaires?.questions || [];
      return questions.some((question) => {
        const fieldName =
          questionFieldMapV2[question.id] || `question_${question.id}`;
        const currentValue = formik.values[fieldName];
        const savedAnswer = savedAnswers.find(
          (answer) => answer?.question_id === question.id
        );

        if (!savedAnswer) {
          // If no saved answer, check if current value is not empty
          return Array.isArray(currentValue)
            ? currentValue.length > 0
            : !!currentValue;
        }

        if (question.question_type === "multi_select") {
          const savedValue = savedAnswer.ans
            ? savedAnswer.ans.split(",").map((s) => s.trim())
            : [];
          const currentArray = Array.isArray(currentValue) ? currentValue : [];
          return (
            JSON.stringify(currentArray.sort()) !==
            JSON.stringify(savedValue.sort())
          );
        } else {
          return currentValue !== (savedAnswer.ans || "");
        }
      });
    } else if (activeTab === "book_appointment") {
      return (
        formik.values.selectedSite !== String(data?.site_id || "") ||
        formik.values.appointmentDate !== (data?.appt_date || "") ||
        formik.values.appointmentTime !== (data?.appt_tome || "") ||
        formik.values.slotId !== (data?.slot_id || "") ||
        formik.values.start_datetime !== (data?.start_datetime || "") ||
        formik.values.end_datetime !== (data?.end_datetime || "")
      );
    }
    return false;
  };

  const handleSaveLead = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const payload = {
        phone: data?.phone || "",
        name: data?.name || "",
        email: data?.email || "",
        zipcode: formik.values.zipcode,
        agent_id: 1,
        message: "ok done",
        lead_id: data?.id,
        showroom_id: Number(formik.values.selectedSite),
        showroom_notes: formik.values.showroomNotes || "No notes provided",
        showroom_next_step: formik.values.nextSteps || "No next step",
        call_notes: "No call notes provided",
        next_notes: "No next notes provided",
        campaign: "No campaign provided",
        medium: "No medium provided",
        source: "No source provided",
        clid: "No clid provided",
        term: "No term provided",
      };

      const response = await createLeadPost(payload);
      console.log("Lead created successfully:", response);
      return response;
    } catch (error) {
      console.error("Error creating lead:", error);
      setSubmitError(error.message || "Failed to save lead");
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch lead info when component mounts
  useEffect(() => {
    const fetchExistingLeadInfo = async () => {
      if (!leadId) {
        setIsLoadingLeadInfo(false);
        return;
      }

      setIsLoadingLeadInfo(true);
      try {
        const response = await fetchLeadInfoById({ lead_id: Number(leadId) });

        if (response && response.answers && response.answers.length > 0) {
          setSavedAnswers(response.answers);
        }
      } catch (error) {
        console.error("Error fetching lead info:", error);
      } finally {
        setIsLoadingLeadInfo(false);
      }
    };

    fetchExistingLeadInfo();
  }, [leadId]);

  // Update form values with saved answers
  useEffect(() => {
    const questions = get_Questionnaires?.questions || [];
    if (!questions.length || !savedAnswers.length) return;

    const updatedValues = { ...formik.values };

    questions.forEach((question) => {
      const savedAnswer = savedAnswers.find(
        (answer) => answer?.question_id === question.id
      );
      if (savedAnswer) {
        const fieldName =
          questionFieldMapV2[question.id] || `question_${question.id}`;
        if (question.question_type === "multi_select") {
          updatedValues[fieldName] = savedAnswer.ans
            ? savedAnswer?.ans?.split(",").map((s) => s.trim())
            : [];
        } else {
          updatedValues[fieldName] = savedAnswer?.ans || "";
        }
        if (savedAnswer.comment !== undefined) {
          updatedValues[`${fieldName}_comment`] = savedAnswer?.comment;
        }
      }
    });

    formik.setValues(updatedValues);
  }, [get_Questionnaires?.questions, savedAnswers]);

  const formik = useFormik({
    // initialValues: getInitialValues(get_Questionnaires?.questions || []),
    initialValues: initialBookingValues,
    validationSchema: getQuestionnaireSchema(
      get_Questionnaires?.questions || []
    ),
    onSubmit: async (values) => {
      try {
        setIsSubmitting(true);
        setSubmitError(null);

        try {
          pushToast({
            isOpen: true,
            action: "success",
            title: "Saved Successfully",
            description: "Showroom Details has been submitted.",
          });
        } catch (storageError) {
          console.error(
            "Error saving form data before API call:",
            storageError
          );
          pushToast({
            isOpen: true,
            action: "info",
            title: "Error",
            description: "Failed to save form data locally.",
          });
        }

        await handleSaveLead();

        const appointmentData = {
          leadId,
          siteId: values.selectedSite,
          siteName: sortedSites.find(
            (site) => site.site_id.toString() === values.selectedSite
          )?.site_name,
          date: values.appointmentDate,
          time: values.appointmentTime,
          customerInfo: {
            shoppedBefore: values.shoppedBefore,
            projectType: values.projectType,
            surfaces: values.surfaces,
            timeline: values.timeline,
            help: values.help,
            contractor: values.contractor,
            comments: {
              shoppedBefore: values.shoppedBeforeComment,
              projectType: values.projectTypeComment,
              surfaces: values.surfacesComment,
              timeline: values.timelineComment,
              help: values.helpComment,
              contractor: values.contractorComment,
            },
            showroomNotes: values.showroomNotes,
            nextSteps: values.nextSteps,
            purpose: values.purpose,
            zipcode: values.zipcode,
          },
        };

        if (appointmentStore.error) {
          throw new Error(appointmentStore.error);
        }
      } catch (error) {
        setSubmitError(error.message || "Failed to book appointment");
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // // Save form data to localStorage whenever values change
  // useEffect(() => {
  //   try {
  //     localStorage.setItem(
  //       `appointmentForm_${leadId}`,
  //       JSON.stringify(formik.values)
  //     );
  //   } catch (error) {
  //     console.error("Error saving form data to localStorage:", error);
  //   }
  // }, [formik.values, leadId]);

  // Update tab validation status
  useEffect(() => {
    const newValidationStatus = {
      questionnaire: validateTab("questionnaire", formik.values),
      book_appointment: validateTab("book_appointment", formik.values),
      details: validateTab("details", formik.values),
    };

    setTabValidationStatus(newValidationStatus);

    // Check if current tab became valid and mark it as dirty for questionnaire
    const questions = get_Questionnaires?.questions || [];
    if (questions.length > 0) {
      const initialValues = getInitialValues(questions);
      const hasChanges =
        JSON.stringify(formik.values) !== JSON.stringify(initialValues);
      setIsDirty(hasChanges);
    }
  }, [formik.values, get_Questionnaires?.questions]);

  // Auto-select first site if none selected
  // useEffect(() => {
  //   if (sortedSites.length > 0 && !formik.values.selectedSite) {
  //     // Only auto-select if no saved data exists
  //     if (!savedData.selectedSite) {
  //       formik.setFieldValue("selectedSite", sortedSites[0].site_id.toString());
  //     }
  //   }
  // }, [sortedSites, savedData.selectedSite]);

  const handleTabChange = (tabId) => {
    // Only allow tab change if the tab is accessible
    if (!isTabAccessible(tabId)) {
      console.log(`Access denied to tab: ${tabId}. Tab not accessible.`);
      return;
    }

    setActiveTab(tabId);
  };
  
  useEffect(() => {
    if (isSaved) {
      setIsSaved(false);
    }
  }, [formik.values]);
  
  // Effect to redirect users if they're on an inaccessible tab
  useEffect(() => {
    if (!isTabAccessible(activeTab)) {
      console.log(`Current tab ${activeTab} is not accessible, redirecting...`);

      // Find the furthest accessible tab based on lead stage
      let accessibleTab = "questionnaire";
      
      if (data?.stage === LeadStageEnum.QUALIFY_LEAD) {
        // Can access questionnaire and book_appointment
        if (completedTabs.has("questionnaire")) {
          accessibleTab = "book_appointment";
        }
      } else if (data?.stage === LeadStageEnum.APPOINTMENT_BOOKED || data?.stage === LeadStageEnum.VISITED) {
        // Can access all tabs, find the furthest completed one
        if (completedTabs.has("book_appointment")) {
          accessibleTab = "details";
        } else if (completedTabs.has("questionnaire")) {
          accessibleTab = "book_appointment";
        }
      }

      setActiveTab(accessibleTab);
    }
  }, [activeTab, completedTabs, data?.stage]);

  const handleNext = async () => {
    let fieldsToValidate = [];

    if (
      activeTab === "questionnaire" &&
      get_Questionnaires?.questions?.length > 0
    ) {
      fieldsToValidate = get_Questionnaires.questions.map(
        (q) => questionFieldMapV2[q.id] || `question_${q.id}`
      );
    } else if (activeTab === "book_appointment") {
      fieldsToValidate = [
        "selectedSite",
        "appointmentDate",
        "slotId",
        "start_datetime",
        "end_datetime",
      ];
    }

    try {
      await formik.validateForm();
      const hasErrors = fieldsToValidate.some(
        (field) => formik.errors[field] && formik.touched[field]
      );

      if (hasErrors) return;

      setIsSubmitting(true);
      setSubmitError(null);
      setSlotBookingError(null); // Clear previous slot booking errors

      if (activeTab === "questionnaire") {
        // First validate required fields from Basic Details and Lead Information
        const validation = validateRequiredFields();

        if (!validation.isValid) {
          const fieldLabels = {
            name: "Name",
            phone: "Phone",
            zipcode: "Zipcode",
            language: "Language",
            lead_owner: "Lead Owner",
            address: "Location",
            status: "Lead Status",
          };

          const missingFieldNames = validation.missingFields
            .map((field) => `<span style="color: red;">${fieldLabels[field]}</span>`)
            .join(", ");

          setErrorMessage(
            `Please fill the required fields in Basic Details and Lead Information: ${missingFieldNames}`
          );
          setShowErrorPopup(true);
          setIsSubmitting(false);
          return;
        }

        // Toast: Show saving start
        pushToast({
          isOpen: true,
          action: "info",
          title: "Saving...",
          description: "Submitting questionnaire responses",
        });

        try {
          const responses = get_Questionnaires.questions
            .map((q) => {
              const fieldName = questionFieldMapV2[q.id] || `question_${q.id}`;
              const value = formik.values[fieldName];
              const comment = formik.values[`${fieldName}_comment`];

              if (
                value === undefined ||
                value === null ||
                value === "" ||
                (Array.isArray(value) && value.length === 0)
              ) {
                return null;
              }

              return {
                question_id: q.id,
                comment,
                response_text: Array.isArray(value)
                  ? value.join(", ")
                  : String(value).trim(),
              };
            })
            .filter(Boolean);

          const requestBody = {
            user_id: Number(leadId),
            response: responses,
          };

          const res = await postQuestionnaire(requestBody);
          LeadStore.changeLeadStage(
            res.stage === "BOOKED_APPOINTMENT"
              ? LeadStageEnum.APPOINTMENT_BOOKED
              : res.stage
          );
          setSavedAnswers(res.answers);
          LeadStore.getLeadInfoFromServer({ lead_id: data?.id }, false);

          // Toast: Show questionnaire success
          pushToast({
            isOpen: true,
            action: "success",
            title: "Saved Successfully",
            description: "Questionnaire has been submitted.",
          });

          // Move to next tab only after successful submission
          const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
          if (currentIndex < tabs.length - 1) {
            const nextTab = tabs[currentIndex + 1].id;
            setActiveTab(nextTab);
          }
        } catch (error) {
          console.error("Questionnaire submission error:", error);
          pushToast({
            isOpen: true,
            action: "error",
            title: "Failed to Save",
            description: "Error submitting questionnaire.",
          });
          throw error;
        }
      } else if (activeTab === "book_appointment") {
        try {
          const appointmentPayload = {
            lead_id: Number(leadId),
            site_id: Number(formik.values.selectedSite),
            slot_id: formik.values.slotId,
            start_datetime:
              formik.values.start_datetime ||
              `${formik.values.appointmentDate} ${formik.values.appointmentTime}`,
            end_datetime:
              formik.values.end_datetime ||
              `${formik.values.appointmentDate} ${
                formik.values.appointmentEndTime || "11:00:00"
              }`,
            notes: formik.values.showroomNotes || "notes",
          };

          const res = await bookAppointmentNew(appointmentPayload);

          LeadStore.changeLeadStage(
            res.stage === "BOOKED_APPOINTMENT"
              ? LEAD_STAGES.APPOINTMENT_BOOKED
              : res.stage
          );
          const appointmentData = res.appointment;
          LeadStore.setLeadInfo(appointmentData, true);
          LeadStore.getLeadInfoFromServer({ lead_id: data?.id }, false);

          // Toast: Show booking success
          pushToast({
            isOpen: true,
            action: "success",
            title: "Appointment Booked",
            description: "Your appointment has been scheduled.",
          });

          // Move to next tab only after successful booking
          const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
          if (currentIndex < tabs.length - 1) {
            const nextTab = tabs[currentIndex + 1].id;
            setActiveTab(nextTab);
          }
        } catch (error) {
          console.error("Appointment booking error:", error);

          // Check if it's a slot booking error
          if (
            error.response?.data?.message?.includes(
              "Selected slot is fully booked"
            ) ||
            error.response?.data?.booked_slots
          ) {
            const errorData = error.response.data;
            const bookedSlots = errorData.booked_slots || [];

            setSlotBookingError({
              message:
                "Selected slot is fully booked. Please choose a different Date/Time." ||
                errorData.message,
              // bookedSlots: bookedSlots,
            });

            // Show specific toast for slot booking error
            pushToast({
              isOpen: true,
              action: "error",
              title: "Slot Unavailable",
              description:
                "Selected slot is fully booked. Please choose a different Date/Time.",
            });

            // Don't progress to next tab
            return;
          } else {
            // Handle other booking errors
            pushToast({
              isOpen: true,
              action: "error",
              title: "Failed to Book",
              description: "Error booking appointment.",
            });
            throw error;
          }
        }
      }
    } catch (error) {
      console.error("Submission error:", error);
      setSubmitError(
        error.response?.data?.message ||
          (activeTab === "questionnaire"
            ? "Failed to save questionnaire"
            : "Failed to book appointment")
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const SlotBookingErrorDisplay = ({ error, onClose }) => {
    if (!error) return null;

    return (
      <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800">
              Slot Booking Error
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p className="mb-2">{error.message}</p>
              {error.bookedSlots && error.bookedSlots.length > 0 && (
                <div>
                  <p className="mb-1 font-medium">Booked slots:</p>
                  <ul className="list-inside list-disc space-y-1">
                    {error.bookedSlots.map((slot, index) => (
                      <li key={index}>
                        {slot.date} from {slot.start_time} to {slot.end_time}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="ml-auto pl-3">
            <button
              onClick={onClose}
              className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50">
              <span className="sr-only">Dismiss</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  useEffect(() => {
    if (slotBookingError) {
      setSlotBookingError(null);
    }
  }, [
    formik.values.slotId,
    formik.values.appointmentDate,
    formik.values.selectedSite,
  ]);

  const handlePrevious = () => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex > 0) {
      const newTabId = tabs[currentIndex - 1].id;
      setActiveTab(newTabId);

      if (newTabId === "questionnaire") {
        // handleStageChange(LEAD_STAGES.QUALIFIED_LEAD);
      } else if (newTabId === "book_appointment") {
        // handleStageChange(LEAD_STAGES.APPOINTMENT_BOOKED);
      }
    }
  };

  const handleSendNotification = () => {
    setShowNotificationModal(false);
    // Add notification sending logic here
  };

  useEffect(() => {
    const hasShowroomNotesChanged =
      formik.values.showroomNotes !== (data?.showroom_notes || "") ||
      formik.values.nextSteps !== (data?.showroom_next_step || "");

    setShowroomNotesModified(hasShowroomNotesChanged);
  }, [
    formik.values.showroomNotes,
    formik.values.nextSteps,
    data?.showroom_notes,
    data?.showroom_next_step,
  ]);
  
  useEffect(() => {
    setShowroomNotesModified(false);
    setIsSaved(false);
  }, [data?.showroom_notes, data?.showroom_next_step]);
  
  return (
    <Observer>
      {() => (
        <div
          className="mx-auto flex flex-col rounded-lg bg-white shadow-md"
          style={{ height: "55vh" }}>
          {/* Tabs Navigation */}
          <div className="flex border-b">
            {tabs.map((tab) => {
              const isAccessible = isTabAccessible(tab.id);
              const isCompleted = completedTabs.has(tab.id);
              const isValid = tabValidationStatus[tab.id];

              return (
                <button
                  key={tab.id}
                  className={`py-3 px-5 text-xs font-medium transition-colors duration-200 focus:outline-none
                  ${
                    activeTab === tab.id
                      ? "border-b-2 border-blue-600 text-[#0043CE]"
                      : isAccessible
                      ? "text-gray-600"
                      : "disable-misc text-gray-400"
                  }
                  ${isCompleted ? "bg-blue-50" : ""}
                  ${
                    isValid && isAccessible
                      ? `${tabs[0].id === tab.id ? "rounded-tl-md" : ""} `
                      : ""
                  }
                `}
                  onClick={() => handleTabChange(tab.id)}
                  disabled={!isAccessible}>
                  <div className="flex items-center space-x-2">
                    <span>{tab.label}</span>
                    {isCompleted && (
                      <span className="text-xs text-blue-600">✓</span>
                    )}
                    {!isAccessible && (
                      <span className="text-xs text-gray-400">🔒</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === "questionnaire" && (
              <FormikProvider value={formik}>
                {get_Questionnaires?.questions?.length > 0 ? (
                  <Questionnaire questions={get_Questionnaires.questions} />
                ) : (
                  <div>Loading questions...</div>
                )}
              </FormikProvider>
            )}

            {activeTab === "book_appointment" && (
              <div>
                <SlotBookingErrorDisplay
                  error={slotBookingError}
                  onClose={() => setSlotBookingError(null)}
                  selectedAvailableSlots={
                    data?.available_slots
                      ? formatSlots(JSON.parse(data?.available_slots))
                      : []
                  }
                />
                <AppointmentSection
                  sortedSites={sortedSites}
                  formik={formik}
                  loadingNearestSites={LeadStore.loadingNearestSites}
                  // selectedAvailableSlots={
                  //   data?.available_slots
                  //     ? formatSlots(JSON.parse(data?.available_slots))
                  //     : []
                  // }
                />
              </div>
            )}
            {activeTab === "details" && (
              <ShowroomDetails
                formik={formik}
                sortedSites={sortedSites}
                store={store}
                leadId={leadId}
                selectedAvailableSlots={selectedAvailableSlots}
              />
            )}
          </div>

          {/* Error Popup */}
          {showErrorPopup && (
            <QualifyLeadValidationPopUp
              onCancel={() => setShowErrorPopup(false)}
              onSave={() => setShowErrorPopup(false)} // Using onSave as a dismiss action
              message={errorMessage}
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between border-t p-4 pt-4">
            <div>
              {activeTab === "details" && (
                <button
                  onClick={() => setShowNotificationModal(true)}
                  disabled={isDisabled}
                  className={`rounded-md px-4 py-1.5 text-xs text-white transition-colors ${
                    isDisabled
                      ? "disable-cursor"
                      : "bg-[#0043CE] hover:bg-blue-700"
                  }`}>
                  Send Notification
                </button>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handlePrevious}
                disabled={activeTab === "questionnaire"}
                className={`rounded-md border border-blue-600 px-4 py-1.5 text-xs ${
                  activeTab === "questionnaire"
                    ? "hidden"
                    : "text-[#0043CE] hover:bg-blue-50"
                }`}>
                Previous Stage
              </button>

              {activeTab === "details" ? (
                <button
                  onClick={async () => {
                    try {
                      await handleSaveLead();
                      await formik.handleSubmit();
                      setShowroomNotesModified(false); // Reset modified state after save
                      setIsSaved(true); // Mark as saved
                    } catch (error) {
                      console.error("Error during save:", error);
                      setIsSaved(false); // Reset on error
                    }
                  }}
                  disabled={isSubmitting || isSaved || !showroomNotesModified} // Disable when submitting OR already saved OR no changes
                  className={`rounded-md px-4 py-1.5 text-xs transition-all duration-200 ${
                    isSubmitting || isSaved || !showroomNotesModified
                      ? "cursor-not-allowed bg-gray-400 text-gray-200"
                      : "bg-[#0043CE] text-white hover:bg-blue-700"
                  }`}>
                  {isSubmitting ? "Saving..." : isSaved ? "Save" : "Save"}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={
                    !tabValidationStatus[activeTab] ||
                    (activeTab === "questionnaire" && !isDirty) ||
                    (activeTab === "questionnaire" &&
                      data?.stage !== LeadStageEnum.LEAD &&
                      !hasFormChangedFromSaved()) ||
                    (activeTab === "book_appointment" &&
                      (data?.stage === LeadStageEnum.APPOINTMENT_BOOKED ||
                        data?.stage === LeadStageEnum.VISITED) &&
                      !hasFormChangedFromSaved())
                  }
                  className={`rounded-md px-4 py-1.5 text-xs text-white ${
                    tabValidationStatus[activeTab] &&
                    (activeTab !== "questionnaire" || isDirty) &&
                    !(
                      (activeTab === "questionnaire" &&
                        data?.stage !== LeadStageEnum.LEAD &&
                        !hasFormChangedFromSaved()) ||
                      (activeTab === "book_appointment" &&
                        (data?.stage === LeadStageEnum.APPOINTMENT_BOOKED ||
                          data?.stage === LeadStageEnum.VISITED) &&
                        !hasFormChangedFromSaved())
                    )
                      ? "bg-[#0043CE] hover:bg-blue-700"
                      : "disable-cursor bg-gray-400"
                  }`}>
                  {isSubmitting
                    ? "Processing..."
                    : activeTab === "book_appointment"
                    ? "Book Appointment"
                    : activeTab === "questionnaire" &&
                      data?.stage !== LeadStageEnum.LEAD &&
                      hasFormChangedFromSaved()
                    ? "Qualify Lead"
                    : "Qualify Lead"}
                </button>
              )}
            </div>
          </div>

          {/* Notification Modal */}
          {showNotificationModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-60"
              onClick={() => setShowNotificationModal(false)}>
              <div
                className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}>
                <h2 className="mb-4 text-lg font-medium text-gray-900">
                  Appointment Details
                </h2>

                <div className="mb-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-700">
                    Status
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-600">Date</div>
                    <div>{formik.values.appointmentDate || "N/A"}</div>

                    <div className="text-gray-600">Referred to Showroom</div>
                    <div>N/A</div>

                    <div className="text-gray-600">Time</div>
                    <div>{formik.values.appointmentTime || "N/A"}</div>

                    <div className="text-gray-600">Lead id</div>
                    <div>{leadId || "N/A"}</div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="mb-2 text-sm font-medium text-gray-700">
                    Showroom Address
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">
                      {sortedSites.find(
                        (site) =>
                          site.site_id.toString() === formik.values.selectedSite
                      )?.location || "No address available"}
                    </p>
                    <div className="text-gray-600">Showroom Name</div>
                    <span className="text-gray-800">
                      {sortedSites.find(
                        (site) =>
                          site.site_id.toString() === formik.values.selectedSite
                      )?.site_name || "N/A"}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between border-t pt-4">
                  <button
                    className="text-sm font-medium text-red-600 hover:text-red-700"
                    onClick={() => setShowNotificationModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="rounded-md bg-[#0043CE] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    onClick={handleSendNotification}>
                    Send Notification
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error message display */}
          {submitError && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{submitError}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Observer>
  );
}