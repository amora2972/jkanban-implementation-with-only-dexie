import {ITicket} from './interfaces/ticket.interface';

export class Ticket implements ITicket {
  id?: any;
  columnId: any;
  title: string;
  order: number;


  constructor(ticket?: ITicket) {
    if (ticket) {
      this.id = ticket.id || null;
      this.order = ticket.order;
      this.columnId = ticket.columnId;
      this.title = ticket.title;
    }
  }
}

