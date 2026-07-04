import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { appendSheetRows } from "@/lib/googleSheets";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as any)?.accessToken;

    if (!token) {
      return NextResponse.json({ status: 'error', message: 'Not authenticated or no access token' }, { status: 401 });
    }

    const tasks = [
      { name: "Create new map Scan First floor.", start: "01/12/2025", end: "01/12/2025", status: "Done", detail: "Map Scanning", remark: "Done", time: "10.00 - 4.30" },
      { name: "Create new map Scan Second floor and Third floor.", start: "02/12/2025", end: "02/12/2025", status: "Done", detail: "Config -> Map -> Map Configuration -> CreateMap And send map scan to Geek+ adjust the map and wait for it to be sent back. Not sure how many days it will take. Covert map file to png", remark: "Done", time: "10.00 - 4.30" },
      { name: "Create Cell add route all 3 floor and Test.", start: "03/12/2025", end: "04/12/2025", status: "Done", detail: "Create a running route for the vehicle, specifying running points at every level. Create Point Charging stations. Rest point.", remark: "Done", time: "10.00 - 4.30" },
      { name: "Holiday", start: "05/12/2025", end: "07/12/2025", status: "Done", detail: "5 Dec 25 Father's Day In thailand holiday", remark: "Done", time: "10.00 - 4.30" },
      { name: "Create Work Flow", start: "08/12/2025", end: "08/12/2025", status: "Done", detail: "Create Workflow", remark: "F1 Only", time: "10.00 - 4.30" },
      { name: "Create container model and test lift up", start: "09/12/2025", end: "09/12/2025", status: "Done", detail: "Create container model and test lift up", remark: "F1 Only", time: "10.00 - 4.30" },
      { name: "Test the robot's running according to the created workflow.", start: "10/12/2025", end: "12/12/2025", status: "Done", detail: "Configuration and Test run.", remark: "F1 Only", time: "10.00 - 4.30" },
      { name: "Configuration System Connect Elevator", start: "15/12/2025", end: "19/12/2025", status: "Cancel", detail: "Geek+ remote and onsite configuration dmp to kone elevator. Eureka provide PLC and configuration.", remark: "DMP can connet PLC , PLC can't connect elevator kone", time: "10.00 - 4.30" },
      { name: "Configuration System Connect Elevator", start: "05/01/2026", end: "09/01/2026", status: "Done", detail: "We're changing the connection method from the original OPC Kone >>> PLC. The new option is to connect the device directly to the elevator control box via the I/O port and convert it into a mosbud signal to be sent to the PLC geek+. Mektec will supply and install all the equipment for us.", remark: "Done", time: "10.00 - 4.30" },
      { name: "Configuration System Connect Elevator", start: "12/01/2026", end: "16/01/2026", status: "Done", detail: "- Mektec team wiring cable Wise-4060-B connect I/O port to Control Box elevator Kone\n- Eureka team training client control call robot on gms move shelf point to point F1 only", remark: "Done", time: "10.00 - 4.30" },
      { name: "Client Test Process Moving AMR F1 all station.", start: "12/01/2026", end: "16/01/2026", status: "Done", detail: "Support Client Test Process Moving AMR F1 all station.", remark: "Done", time: "10.00 - 4.30" },
      { name: "Create user interface for client", start: "18/01/2026", end: "23/01/2026", status: "Done", detail: "Create user interface for client", remark: "Done", time: "09.00- 6.00" },
      { name: "Geek+ Config DMP Interlog PLC", start: "26/01/2026", end: "30/01/2026", status: "Done", detail: "Geek+ Config DMP Interlog PLC control elevator", remark: "Done", time: "09.00 - 6.00" },
      { name: "Support Geek+ Onsite Mektec", start: "02/02/2026", end: "06/02/2026", status: "Done", detail: "MEKTEC currently has the following issues:\n1.Error when production cart doesn't fully lift (indicated by an alarm)\n2.Quinning issues when delivering to the same destination\n3.Finding new routes when jobs collide (currently fixed to find a new point, but it doesn't seem to be working well enough as it circles around the elevator several times before finding a way)\n4.Client wants help speeding up subtask execution. For example, placing and rotating before entering the part box. We haven't found a solution for this yet; we only found ways to return to the rest point faster after the job is finished.\n5.The PLC still needs testing the elevator control sequence; I'm getting help from Geek+ to create the sequence used to control the elevator.", remark: "Done", time: "09.00 - 6.00" },
      { name: "Create WorkFlow B3F2, B3F3", start: "09/02/2026", end: "11/02/2026", status: "Done", detail: "Create WorkFlow B3F2, B3F3 and test run robot.", remark: "", time: "09.00 - 6.00" },
      { name: "Go live", start: "16/02/2026", end: "16/02/2026", status: "Done", detail: "", remark: "Done", time: "09.00 - 6.00" }
    ];

    const assignee = "witsarut@eurekaautomation.co.th";
    const projectCode = "EUREKA";
    const priority = "Normal";

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const rowsToAppend = tasks.map(t => {
      const descParts = [];
      if (t.detail) descParts.push(t.detail);
      if (t.time) descParts.push(`Time: ${t.time}`);
      if (t.remark) descParts.push(`Remark: ${t.remark}`);
      const desc = descParts.join("\n");
      
      return [
        generateId(),
        projectCode,
        t.name,
        desc,
        assignee,
        t.start,
        t.end,
        t.status,
        priority
      ];
    });

    const result = await appendSheetRows(token, 'Tasks!A1:I', rowsToAppend);

    return NextResponse.json({ status: 'success', message: 'Seeded tasks successfully', data: result });
  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
